const mongoose = require("mongoose");

const configSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    exchange: {
        required: true,
        type: Number,
        default:74
    },
    date: {
        type: Date,
        default: Date.now()
    }
   
});

module.exports = Config = mongoose.model("config", configSchema);