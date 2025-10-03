const mongoose = require("mongoose");

const paidAlbumSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    genre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Genre",
      required: true,
    },
    bpm: {
      type: Number,
      required: true,
    },
    length: {
      type: Number,
      required: true,
    },
    tracks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Track",
        required: true,
      },
    ],
    file: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaidAlbum", paidAlbumSchema);
