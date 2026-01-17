const mongoose = require('mongoose');
const GamesDB = {
    fetchAll: async () => await mongoose.model('GameLevel').find({}).lean(),
    upsert: async (data) => {
        const Model = mongoose.model('GameLevel');
        if (data._id) return await Model.findByIdAndUpdate(data._id, data, { new: true });
        return await Model.create(data);
    }
};
module.exports = GamesDB;