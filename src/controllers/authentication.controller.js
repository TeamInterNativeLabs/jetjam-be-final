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

    // Block login if email not verified (skip for admin logins)
    if (requestedUser === ROLES.USER && !userExist.email_verified) {
      return res.status(403).send({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox for the verification code.',
        email_unverified: true,
        email: userExist.email
      });
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
      `JetJams <johnnyo@jetjams.net>`,
      userExist.email,
      "JetJams — Password Recovery Code",
      `Your JetJams password recovery code is: ${otp}\n\nThis code expires in 1 hour.\n\nIf you did not request this, please ignore this email.`
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

// Called after registration — sends OTP to verify email
const sendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) throw new Error('Email is required');

    const user = await User.findOne({ email }, { _id: 1, email: 1, email_verified: 1 });
    if (!user) throw new Error(ERRORS.USER_NOTEXIST);

    if (user.email_verified) {
      return res.status(200).send({ success: true, message: 'Email already verified' });
    }

    await Otp.deleteMany({ userId: user._id });

    const otp = await generateOTP();
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);

    await new Otp({ otp, expiry, userId: user._id }).save();

    await sendMail(
      `JetJams <johnnyo@jetjams.net>`,
      user.email,
      'JetJams — Verify Your Email',
      `Welcome to JetJams!\n\nYour email verification code is: ${otp}\n\nThis code expires in 1 hour.\n\nIf you did not create an account, please ignore this email.`
    );

    return res.status(200).send({ success: true, message: 'Verification code sent to your email' });
  } catch (e) {
    console.log('sendVerificationEmail error:', e);
    return res.status(400).send({ success: false, message: e.message });
  }
};

// Verifies the OTP and marks email as verified
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) throw new Error('Email and OTP are required');

    const user = await User.findOne({ email });
    if (!user) throw new Error(ERRORS.USER_NOTEXIST);

    if (user.email_verified) {
      return res.status(200).send({ success: true, message: 'Email already verified' });
    }

    const otpRecord = await Otp.findOne({ userId: user._id });
    if (!otpRecord) throw new Error('No verification code found. Please request a new one.');

    const now = new Date();
    if (now > otpRecord.expiry) throw new Error('Verification code has expired. Please request a new one.');
    if (String(otp) !== String(otpRecord.otp)) throw new Error('Invalid verification code');

    await User.findByIdAndUpdate(user._id, { email_verified: true });
    await Otp.deleteMany({ userId: user._id });

    return res.status(200).send({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (e) {
    console.log('verifyEmail error:', e);
    return res.status(400).send({ success: false, message: e.message });
  }
};

module.exports = {
  login,
  logout: async (req, res) => {
    // JWT is stateless — client clears the token.
    // This endpoint exists so the client can call it on logout
    // and we can log the event / invalidate device tokens if needed.
    try {
      if (req.decoded?.id) {
        // Remove device token if present
        await User.findByIdAndUpdate(req.decoded.id, { $set: { device_ids: [] } })
      }
      return res.status(200).send({ success: true, message: 'Logged out successfully' })
    } catch (e) {
      return res.status(200).send({ success: true, message: 'Logged out' })
    }
  },
  forgetPassword,
  verifyOtp,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
};
