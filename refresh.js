const { Users, Groups } = require('./MeModule/SequelizeModels');

var c = Groups.count();


Groups.update({ Status: 0 }, {
        where: {
            id: 3
        }
    }).then(function(){
        console.log('Статусы обновлены');
    });