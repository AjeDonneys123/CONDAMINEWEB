const mongoose = require('mongoose');
const HomeworkDB = {
    getAll: async () => await mongoose.model('Homework').find({}).sort({ date: -1 }).lean(),
    save: async (data) => {
        const Model = mongoose.model('Homework');
        if (data._id) return await Model.findByIdAndUpdate(data._id, data, { new: true });
        return await Model.create(data);
    }
};
module.exports = HomeworkDB;