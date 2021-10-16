const { DataTypes } = require('sequelize');
const { sequelize } = require('./ConnectDatabase');

//---------------------------------------------------------------------------------------------------------------------------------------------------------

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
        type: DataTypes.INTEGER,
        allowNull: false
    },
});

const Attendance = sequelize.define('Attendance', {
    Date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    idGroup: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    idUser: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    value:{
        type: DataTypes.JSON,
        allowNull: false
    }
});

const Groups = sequelize.define('Groups', {
    Name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    Status: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    }
})

//---------------------------------------------------------------------------------------------------------------------------------------------------------
   
Attendance.belongsTo(Groups, {
    foreignKey: 'idGroup', 
    targetKey: 'id'
});

Attendance.belongsTo(Users, {
    foreignKey: 'idUser', 
    targetKey: 'id'
});

Users.belongsTo(Groups, {
    foreignKey: 'group', 
    targetKey: 'id'
});

//---------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = {Users, Attendance, Groups}