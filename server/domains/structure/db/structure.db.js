



const mongoose = require('mongoose');
const StructureDB = {
    getAll: async () => await mongoose.model('Chapter').find({}).lean(),
    create: async (data) => await mongoose.model('Chapter').create({ ...data, title: data.title.toUpperCase() }),
    update: async (id, data) => await mongoose.model('Chapter').findByIdAndUpdate(id, { $set: data }, { new: true }),
    delete: async (id) => await mongoose.model('Chapter').findByIdAndDelete(id)
};
module.exports = StructureDB;



