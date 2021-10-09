const { DataTypes } = require('sequelize');
const { sequelize } = require('./ConnectDatabase');

//---------------------------------------------------------------------------

const Users = sequelize.define('Users', {
    login: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    first_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    surname: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    group:{
        type: DataTypes.STRING(10),
        allowNull: false
    },
});
    
console.log(Users === sequelize.models.Users);

//---------------------------------------------------------------------------

module.exports = {Users}