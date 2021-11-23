const { Sequelize } = require('sequelize');

//---------------------------------------------------------------------------

const sequelize = new Sequelize('petroAttendance', 'root', 'root', {
    host: 'localhost',
    dialect: 'mysql'
});

try {
    sequelize.authenticate();
    console.log('Успешно приконектились! Полетели!');
} catch (error) {
    console.error('Не получилось :c дело в том, что ', error); 
}

//---------------------------------------------------------------------------

module.exports = {sequelize};