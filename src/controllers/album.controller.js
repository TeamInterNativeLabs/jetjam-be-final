const mongoose = require("mongoose");
const Album = require("../models/album.model");
const PaidAlbum = require("../models/paid_album.model");
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
    const { price } = req.body;

    const order = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders`,
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
              amount: {
                currency_code: "USD",
                value: `${price}.00`,
              },
            },
          ],
        }),
      }
    );

    const _order = await order.json();
    console.log(_order, "order");

    return res.status(201).json({ id: _order.id });
  } catch (error) {
    console.log(error);
  }
};

const capture_album_order = async (req, res, next) => {
  try {
    const { order_id } = req.body;
    const accessToken = await paypalClient.getAccessToken();
    const album = await Album.findOne();
    console.log(album);

    const capture = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${order_id}/capture`,
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
              amount: {
                currency_code: "USD",
                value: "10.00",
              },
            },
          ],
        }),
      }
    );

    const _order = await capture.json();
    console.log(_order, "order");

    return res.status(201).json({ id: _order.id });
  } catch (error) {
    console.log(error);
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
            file: {
              $cond: {
                if: {
                  $or: [
                    { $in: ["$genre", access_to] },
                    { $eq: ["$free", true] },
                  ],
                },
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

module.exports = {
  createPaidAlbum,
  getPaidAlbum,
  getAllPaidAlbum,
  createAlbum,
  getAlbum,
  getAlbumById,
  handleStatus,
  deleteAlbum,
  create_album_order,
  capture_album_order,
};
