const User = require("../models/user.model");
const Otp = require("../models/otp.model");
const Subscription = require("../models/subscription.model");
const { comparePassword } = require("../helpers/encryption");
const { generateToken } = require("../helpers/token");
const { generateOTP, ERRORS, ROLES } = require("../utils");
const { sendMail } = require("../helpers/email");

const login = async (req, res) => {
  try {
    let { email, password, source, deviceId } = req.body;

    if (!email || !password) {
      throw new Error(ERRORS.REQUIRED_FIELD);
    }

    let projection = { __v: 0, createdAt: 0, updatedAt: 0 };

    let userExist = await User.findOne({ email }, projection);

    if (!userExist) {
      throw new Error(ERRORS.INVALID_CREDENTIALS);
    }

    let validPassword = await comparePassword(password, userExist.password);

    if (!validPassword) {
      throw new Error(ERRORS.INVALID_CREDENTIALS);
    }

    let requestedUser = source ? source : ROLES.USER;

    if (requestedUser !== userExist.role) {
      throw new Error(ERRORS.UNAUTHORIZED);
    }

    let activeUser = userExist.active;

    if (!activeUser) {
      throw new Error(ERRORS.BLOCKEDBY_ADMIN);
    }

    let token = await generateToken({
      id: userExist._id,
      email: userExist.email,
      role: userExist.role,
    });

    if (deviceId) {
      userExist.deviceId = deviceId;
    }

    await userExist.save();

    let currentUser = { ...userExist._doc };

    delete currentUser.password;

    const now = new Date();

    const subscription = await Subscription.findOne({
      user: currentUser?._id,
      expiry: { $gte: now },
      active: true,
    }).populate("package");

    currentUser.subscription = subscription;

    console.log(currentUser);

    return res.status(200).send({
      success: true,
      message: "User successfully logged in",
      token,
      data: currentUser,
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const forgetPassword = async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      throw new Error("Email is not provided");
    }

    let userExist = await User.findOne({ email }, { _id: 1, email: 1 });

    if (!userExist) {
      throw new Error(ERRORS.USER_NOTEXIST);
    }

    let otpExist = await Otp.findOne({ userId: userExist._id });

    if (otpExist) {
      await Otp.findByIdAndDelete(otpExist._id);
    }

    let otp = await generateOTP();
    let expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);

    let payload = {
      otp,
      expiry,
      userId: userExist._id,
    };

    let otpData = new Otp(payload);
    await otpData.save();

    console.log(otp, "otp-----------------------");

    await sendMail(
      "The Watchers <noreply@thewatchers.com>",
      userExist.email,
      "Password Recovery Code",
      otp
    );

    return res.status(200).send({
      success: true,
      message: "Email has been sent successfully",
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    let { email, otp } = req.body;

    if (!email || !otp) {
      throw new Error("Email or OTP is not provided");
    }

    let userExist = await User.findOne({ email });

    if (!userExist) {
      throw new Error(ERRORS.USER_NOTEXIST);
    }

    let otpExist = await Otp.findOne({ userId: userExist._id });

    let now = new Date();

    if (now < otpExist.expiry) {
      if (otp == otpExist.otp) {
        return res.status(200).send({
          success: true,
          message: "OTP Verified",
        });
      } else {
        throw new Error("Invalid OTP");
      }
    } else {
      throw new Error("OTP has been expired");
    }
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      throw new Error("Email or Password is not provided");
    }

    let userExist = await User.findOne({ email });

    if (!userExist) {
      throw new Error(ERRORS.USER_NOTEXIST);
    }

    await User.findOneAndUpdate({ _id: userExist._id }, { password });

    return res.status(200).send({
      success: true,
      message: "Password reset successfully",
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

module.exports = {
  login,
  forgetPassword,
  verifyOtp,
  resetPassword,
};
