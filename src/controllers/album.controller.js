const mongoose = require("mongoose");
const Album = require("../models/album.model");
const PaidAlbum = require("../models/paid_album.model");
const AlbumPurchase = require("../models/album_purchase.model");
const Track = require("../models/track.model");
const { removeImage } = require("../helpers/image");
const {
  ERRORS,
  objectValidator,
  paginationHandler,
  getSearchQuery,
  getDateRangeQuery,
  convertToSeconds,
  ROLES,
} = require("../utils");

const paypalClient = require("../configs/paypal");

const create_album_order = async (req, res, next) => {
  try {
    const accessToken = await paypalClient.getAccessToken();
    const { albumId, price } = req.body;

    if (!albumId || !price) {
      return res.status(400).json({ success: false, message: 'albumId and price are required' });
    }

    // Verify the album exists and get its actual price
    const album = await PaidAlbum.findById(albumId);
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    // FIX: use album's actual price, formatted correctly
    const formattedPrice = parseFloat(album.price).toFixed(2);

    const order = await fetch(
      `${process.env.PAYPAL_API_URL}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: albumId, // store albumId so we can retrieve it on capture
              description: album.name,
              amount: {
                currency_code: "USD",
                value: formattedPrice,
              },
            },
          ],
        }),
      }
    );

    const _order = await order.json();

    if (!_order.id) {
      return res.status(400).json({ success: false, message: 'PayPal order creation failed', details: _order });
    }

    return res.status(201).json({ id: _order.id });
  } catch (error) {
    console.log('create_album_order error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const capture_album_order = async (req, res, next) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, message: 'order_id is required' });
    }

    const accessToken = await paypalClient.getAccessToken();

    const capture = await fetch(
      `${process.env.PAYPAL_API_URL}/v2/checkout/orders/${order_id}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const _order = await capture.json();

    if (_order.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: `Payment not completed. Status: ${_order.status}` });
    }

    const albumId    = _order.purchase_units?.[0]?.reference_id;
    const amountPaid = parseFloat(_order.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || 0);
    const payerEmail = _order.payer?.email_address;
    const payerFirst = _order.payer?.name?.given_name || '';
    const payerLast  = _order.payer?.name?.surname || '';
    const payerName  = `${payerFirst} ${payerLast}`.trim();

    // Extract billing address
    const shipping    = _order.purchase_units?.[0]?.shipping?.address;
    const payerAddr   = shipping
      ? [shipping.address_line_1, shipping.address_line_2, shipping.admin_area_2, shipping.admin_area_1, shipping.postal_code, shipping.country_code]
          .filter(Boolean).join(', ')
      : null;

    if (!albumId) {
      return res.status(400).json({ success: false, message: 'Could not determine album from order' });
    }

    // Check already recorded (idempotent)
    let purchase = await AlbumPurchase.findOne({ paypal_order_id: order_id });

    if (!purchase) {
      // Try to find registered user by payer email
      let userIdToSave = req.decoded?.id || null;
      if (!userIdToSave && payerEmail) {
        try {
          const User = require('../models/user.model');
          const user = await User.findOne({ email: payerEmail });
          if (user) userIdToSave = user._id;
        } catch (_) {}
      }

      // Generate a secure random download token (no expiry)
      const crypto = require('crypto');
      const downloadToken = crypto.randomBytes(32).toString('hex');

      purchase = new AlbumPurchase({
        ...(userIdToSave ? { user: userIdToSave } : {}),
        album:           albumId,
        paypal_order_id: order_id,
        amount_paid:     amountPaid,
        payer_email:     payerEmail || null,
        payer_name:      payerName  || null,
        payer_address:   payerAddr  || null,
        download_token:  downloadToken,
      });
      await purchase.save();

      // Send lifetime download email
      try {
        const { sendMail } = require('../helpers/email');
        const album = await PaidAlbum.findById(albumId);
        const recipientEmail = payerEmail;

        if (recipientEmail && album) {
          const siteUrl = process.env.SITE_URL?.replace(/\/$/, '') || 'https://www.jetjams.net';
          const downloadUrl = `${siteUrl}/album-download/${downloadToken}`;

          await sendMail(
            `JetJams <johnnyo@jetjams.net>`,
            recipientEmail,
            `Your JetJams Download: ${album.name}`,
            `Hi ${payerName || 'there'},\n\nThank you for purchasing "${album.name}" on JetJams!\n\nYour payment of $${amountPaid} has been received.\n\nYou can download your album anytime using this permanent link:\n\n${downloadUrl}\n\nThis link never expires — you can use it as many times as you like.\n\nThank you for supporting the artists!\n\nThe JetJams Team\nhttps://www.jetjams.net`
          );
          console.log(`[ALBUM PURCHASE] Email sent to ${recipientEmail} for "${album.name}"`);
        }
      } catch (emailErr) {
        console.log('[ALBUM PURCHASE] Email send failed (non-fatal):', emailErr.message);
      }
    }

    return res.status(201).json({
      success:        true,
      id:             _order.id,
      status:         _order.status,
      download_token: purchase.download_token,
      payer_email:    purchase.payer_email,
    });
  } catch (error) {
    console.log('capture_album_order error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createAlbum = async (req, res) => {
  try {
    let { body } = req;

    let validate = objectValidator(body);

    if (!validate) {
      throw new Error(ERRORS.NULL_FIELD);
    }

    let tracks = await Track.insertMany(body.tracks);
    tracks = tracks?.map((item) => item._id);

    let payload = {
      ...body,
      tracks,
    };

    console.log(payload);

    let album = new Album(payload);
    await album.save();

    return res.status(200).send({
      success: true,
      message: "Album Successfully Saved",
      data: album,
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const createPaidAlbum = async (req, res) => {
  try {
    let { body } = req;

    let validate = objectValidator(body);

    if (!validate) {
      throw new Error(ERRORS.NULL_FIELD);
    }

    let tracks = await Track.insertMany(body.tracks);
    tracks = tracks?.map((item) => item._id);

    let payload = {
      ...body,
      tracks,
    };

    console.log(payload);

    await PaidAlbum.updateMany(
      { active: true }, // Filter: only currently active albums
      { $set: { active: false } } // Update: set active to false
    );

    let paid_album = new PaidAlbum(payload);
    await paid_album.save();

    return res.status(200).send({
      success: true,
      message: "Album Successfully created",
      data: paid_album,
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const getPaidAlbum = async (req, res) => {
  try {
    let album = await PaidAlbum.aggregate([
      { $match: { active: true } },
      // {
      //   $addFields: {
      //     playable: {
      //       $or: [{ $in: ["$genre", access_to] }, { $eq: ["$free", true] }],
      //     },
      //     file: {
      //       $cond: {
      //         if: {
      //           $or: [{ $in: ["$genre", access_to] }, { $eq: ["$free", true] }],
      //         },
      //         then: "$file",
      //         else: null,
      //       },
      //     },
      //   },
      // },
      {
        $lookup: {
          from: "tracks",
          localField: "tracks",
          foreignField: "_id",
          as: "tracks",
        },
      },
    ]);

    if (!album.length) {
      return res.status(404).send({
        success: false,
        message: "Album not found",
      });
    }

    return res.status(200).send({
      success: true,
      data: album[0],
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const getAllPaidAlbum = async (req, res) => {
  try {
    let { query, access_to, decoded } = req;
    let {
      page,
      rowsPerPage,
      search,
      from,
      to,
      sortBy,
      suggested,
      newAlbum,
      trending,
      genre,
      bpm,
      length,
      free,
    } = query;

    let options = paginationHandler(page, rowsPerPage);

    console.log(options, "test");

    let filter = {};
    let sort = { createdAt: -1 };
    let projection = { file: 0 };

    if (!decoded?.role || (decoded && decoded.role === ROLES.USER)) {
      filter.active = true;
    }

    if (search) {
      filter = { ...filter, name: getSearchQuery(search) };
    }

    if (from || to) {
      filter = { ...filter, createdAt: getDateRangeQuery(from, to) };
    }

    if (query.hasOwnProperty("suggested")) {
      filter.suggested = Boolean(suggested);
    }

    if (query.hasOwnProperty("newAlbum")) {
      filter.new = Boolean(newAlbum);
    }

    if (query.hasOwnProperty("trending")) {
      filter.trending = Boolean(trending);
    }

    if (query.hasOwnProperty("free")) {
      filter.free = Boolean(free);
    }

    if (sortBy) {
      sort = { [sortBy]: 1 };
    }

    if (genre && genre !== "") {
      filter.genre = new mongoose.Types.ObjectId(genre);
    }

    if (bpm && bpm !== "") {
      filter.bpm = Number(bpm);
    }

    if (length && length !== "") {
      filter.length = Number(length);
    }

    let albums = null;

    if (req?.decoded && req?.decoded?.role === ROLES.ADMIN) {
      albums = await PaidAlbum.find(filter, projection, options).populate(
        "genre"
      );
    } else {
      projection = {
        name: 1,
        description: 1,
        image: 1,
        playable: 1,
        length: 1,
        genre: 1,
        createdAt: 1,
        tracks: 1,
        file_url: 1,
      };

      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            playable: {
              $or: [{ $in: ["$genre", access_to] }, { $eq: ["$free", true] }],
            },
          },
        },
        {
          $addFields: {
            file_url: {
              $cond: {
                if: { $eq: ["$playable", true] },
                then: "$file",
                else: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "genres",
            localField: "genre",
            foreignField: "_id",
            as: "genre",
          },
        },
        {
          $unwind: {
            path: "$genre",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "tracks",
            localField: "tracks",
            foreignField: "_id",
            as: "tracks",
          },
        },
        { $project: projection },
        { $sort: { createdAt: -1 } },
      ];

      if (typeof options.skip === "number") {
        pipeline.push({ $skip: options.skip });
      }
      if (typeof options.limit === "number") {
        pipeline.push({ $limit: options.limit });
      }

      albums = await PaidAlbum.aggregate(pipeline);
    }

    let total = await PaidAlbum.countDocuments(filter);

    return res.status(200).send({
      success: true,
      total,
      data: albums,
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const getAlbum = async (req, res) => {
  try {
    let { query, access_to, decoded } = req;
    let {
      page,
      rowsPerPage,
      search,
      from,
      to,
      sortBy,
      suggested,
      newAlbum,
      trending,
      genre,
      bpm,
      length,
      free,
    } = query;

    let options = paginationHandler(page, rowsPerPage);

    console.log(options, "test");

    let filter = {};
    let sort = { createdAt: -1 };
    let projection = { file: 0 };

    if (!decoded?.role || (decoded && decoded.role === ROLES.USER)) {
      filter.active = true;
    }

    if (search) {
      filter = { ...filter, name: getSearchQuery(search) };
    }

    if (from || to) {
      filter = { ...filter, createdAt: getDateRangeQuery(from, to) };
    }

    if (query.hasOwnProperty("suggested")) {
      filter.suggested = Boolean(suggested);
    }

    if (query.hasOwnProperty("newAlbum")) {
      filter.new = Boolean(newAlbum);
    }

    if (query.hasOwnProperty("trending")) {
      filter.trending = Boolean(trending);
    }

    if (query.hasOwnProperty("free")) {
      filter.free = Boolean(free);
    }

    if (sortBy) {
      sort = { [sortBy]: 1 };
    }

    if (genre && genre !== "") {
      filter.genre = new mongoose.Types.ObjectId(genre);
    }

    if (bpm && bpm !== "") {
      filter.bpm = Number(bpm);
    }

    if (length && length !== "") {
      filter.length = Number(length);
    }

    let albums = null;

    if (req?.decoded && req?.decoded?.role === ROLES.ADMIN) {
      albums = await Album.find(filter, projection, options).populate("genre");
    } else {
      projection = {
        name: 1,
        description: 1,
        image: 1,
        playable: 1,
        length: 1,
        genre: 1,
        createdAt: 1,
        tracks: 1,
        file_url: 1,
      };

      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            playable: {
              $or: [{ $in: ["$genre", access_to] }, { $eq: ["$free", true] }],
            },
          },
        },
        {
          $addFields: {
            file_url: {
              $cond: {
                if: { $eq: ["$playable", true] },
                then: "$file",
                else: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "genres",
            localField: "genre",
            foreignField: "_id",
            as: "genre",
          },
        },
        {
          $unwind: {
            path: "$genre",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "tracks",
            localField: "tracks",
            foreignField: "_id",
            as: "tracks",
          },
        },
        { $project: projection },
        { $sort: sort },
      ];

      if (typeof options.skip === "number") {
        pipeline.push({ $skip: options.skip });
      }
      if (typeof options.limit === "number") {
        pipeline.push({ $limit: options.limit });
      }

      albums = await Album.aggregate(pipeline);
    }

    let total = await Album.countDocuments(filter);

    return res.status(200).send({
      success: true,
      total,
      data: albums,
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const getAlbumById = async (req, res) => {
  try {
    let { params, access_to } = req;
    let { id } = params;

    let album = null;

    if (req?.decoded && req?.decoded?.role === ROLES.ADMIN) {
      let album_data = await Album.findById(id).populate("genre tracks");

      if (!album_data) {
        return res.status(404).send({
          success: false,
          message: "Album not found",
        });
      }

      album = [album_data];
    } else {
      album = await Album.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(id) } },
        {
          $addFields: {
            playable: {
              $or: [{ $in: ["$genre", access_to] }, { $eq: ["$free", true] }],
            },
          },
        },
        {
          $addFields: {
            file_url: {
              $cond: {
                if: { $eq: ["$playable", true] },
                then: "$file",
                else: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "tracks",
            localField: "tracks",
            foreignField: "_id",
            as: "tracks",
          },
        },
      ]);

      if (!album.length) {
        return res.status(404).send({
          success: false,
          message: "Album not found",
        });
      }
    }

    return res.status(200).send({
      success: true,
      data: album[0],
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const handleStatus = async (req, res) => {
  try {
    let { params } = req;

    let album = await Album.findById(params?.id);

    if (!album) {
      throw new Error("Album not found");
    }

    album.active = !album.active;
    await album.save();

    return res.status(200).send({
      success: true,
      message: "Album Successfully Updated",
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const deleteAlbum = async (req, res) => {
  try {
    let { params } = req;

    let album = await Album.findById(params?.id);

    if (!album) {
      throw new Error("Album not found");
    }

    await Track.deleteMany({ _id: { $in: album.tracks } });
    removeImage(album?.image);
    removeImage(album?.file);
    await Album.findByIdAndDelete(album._id);

    return res.status(200).send({
      success: true,
      message: "Album Successfully Deleted",
    });
  } catch (e) {
    console.log("Error Message :: ", e);
    return res.status(400).send({
      success: false,
      message: e.message,
    });
  }
};

const updateAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req;

    const album = await Album.findById(id);
    if (!album) {
      return res.status(404).send({ success: false, message: 'Album not found' });
    }

    // If new tracks provided, replace them
    if (body.tracks && Array.isArray(body.tracks)) {
      await Track.deleteMany({ _id: { $in: album.tracks } });
      const newTracks = await Track.insertMany(
        body.tracks.map(t => typeof t === 'object' && !t._id ? t : { name: t.name || t })
      );
      body.tracks = newTracks.map(t => t._id);
    }

    const updated = await Album.findByIdAndUpdate(id, body, { new: true }).populate('genre');

    return res.status(200).send({
      success: true,
      message: 'Album Successfully Updated',
      data: updated,
    });
  } catch (e) {
    console.log('updateAlbum error:', e);
    return res.status(400).send({ success: false, message: e.message });
  }
};

// Update a PaidAlbum by ID
const updatePaidAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    const album = await PaidAlbum.findById(id);
    if (!album) {
      return res.status(404).send({ success: false, message: 'Paid album not found' });
    }

    // Replace tracks if new ones provided
    if (body.tracks && Array.isArray(body.tracks)) {
      await Track.deleteMany({ _id: { $in: album.tracks } });
      const newTracks = await Track.insertMany(
        body.tracks.map(t => typeof t === 'object' && !t._id ? t : { name: t.name || t })
      );
      body.tracks = newTracks.map(t => t._id);
    }

    // Remove read-only fields
    delete body._id; delete body.__v; delete body.createdAt; delete body.updatedAt;

    const updated = await PaidAlbum.findByIdAndUpdate(id, body, { new: true }).populate('genre tracks');

    return res.status(200).send({
      success: true,
      message: 'Paid Album Successfully Updated',
      data: updated,
    });
  } catch (e) {
    console.log('updatePaidAlbum error:', e);
    return res.status(400).send({ success: false, message: e.message });
  }
};

// Get a single PaidAlbum by ID (for admin edit/detail view)
const getPaidAlbumById = async (req, res) => {
  try {
    const { id } = req.params;
    const album = await PaidAlbum.findById(id).populate('genre tracks');
    if (!album) {
      return res.status(404).send({ success: false, message: 'Paid album not found' });
    }
    return res.status(200).send({ success: true, data: album });
  } catch (e) {
    console.log('getPaidAlbumById error:', e);
    return res.status(400).send({ success: false, message: e.message });
  }
};

// Delete a PaidAlbum by ID
const deletePaidAlbum = async (req, res) => {
  try {
    const { id } = req.params;
    const album = await PaidAlbum.findById(id);
    if (!album) {
      return res.status(404).send({ success: false, message: 'Paid album not found' });
    }
    await Track.deleteMany({ _id: { $in: album.tracks } });
    removeImage(album?.image);
    removeImage(album?.file);
    await PaidAlbum.findByIdAndDelete(id);
    return res.status(200).send({ success: true, message: 'Paid Album Deleted Successfully' });
  } catch (e) {
    console.log('deletePaidAlbum error:', e);
    return res.status(400).send({ success: false, message: e.message });
  }
};

// Toggle active status on PaidAlbum
const handlePaidAlbumStatus = async (req, res) => {
  try {
    const album = await PaidAlbum.findById(req.params.id);
    if (!album) return res.status(404).send({ success: false, message: 'Paid album not found' });
    album.active = !album.active;
    await album.save();
    return res.status(200).send({ success: true, message: 'Status Updated' });
  } catch (e) {
    return res.status(400).send({ success: false, message: e.message });
  }
};

const getMyPurchases = async (req, res) => {
  try {
    const userId = req.decoded.id;
    const purchases = await AlbumPurchase.find({ user: userId })
      .populate('album')
      .sort({ createdAt: -1 });

    return res.status(200).send({
      success: true,
      data: purchases,
    });
  } catch (e) {
    console.log('getMyPurchases error:', e);
    return res.status(400).send({ success: false, message: e.message });
  }
};

// Secure download — verifies the user has purchased the album before serving the file
const downloadAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const userId = req.decoded.id;

    // Check the user has a purchase record for this album
    const purchase = await AlbumPurchase.findOne({ user: userId, album: albumId });
    if (!purchase) {
      return res.status(403).send({
        success: false,
        message: 'You have not purchased this album.'
      });
    }

    const album = await PaidAlbum.findById(albumId);
    if (!album || !album.file) {
      return res.status(404).send({ success: false, message: 'Album file not found.' });
    }

    // Build the absolute path to the file
    const path = require('path');
    const fs = require('fs');
    const filePath = path.join(__dirname, '../../../', album.file);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send({ success: false, message: 'File not found on server.' });
    }

    // Set headers for file download
    const fileName = `${album.name.replace(/[^a-z0-9]/gi, '_')}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (e) {
    console.log('downloadAlbum error:', e);
    return res.status(400).send({ success: false, message: e.message });
  }
};

// Download by secure token — no auth required, lifetime access
const downloadByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const purchase = await AlbumPurchase.findOne({ download_token: token });
    if (!purchase) {
      return res.status(403).json({ success: false, message: 'Invalid or expired download link.' });
    }

    const album = await PaidAlbum.findById(purchase.album);
    if (!album || !album.file) {
      return res.status(404).json({ success: false, message: 'Album file not found.' });
    }

    const pathMod  = require('path');
    const fs2      = require('fs');
    const filePath = pathMod.join(__dirname, '../../../', album.file.replace(/\\/g, '/'));

    if (!fs2.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' });
    }

    const fileName = `${album.name.replace(/[^a-z0-9]/gi, '_')}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/zip');
    fs2.createReadStream(filePath).pipe(res);
  } catch (e) {
    console.log('downloadByToken error:', e);
    return res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  createPaidAlbum,
  getPaidAlbum,
  getAllPaidAlbum,
  getPaidAlbumById,
  updatePaidAlbum,
  deletePaidAlbum,
  handlePaidAlbumStatus,
  createAlbum,
  getAlbum,
  getAlbumById,
  handleStatus,
  deleteAlbum,
  create_album_order,
  capture_album_order,
  getMyPurchases,
  updateAlbum,
  downloadAlbum,
  downloadByToken,
};
