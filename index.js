const { Users, Attendance, Groups} = require('./MeModule/SequelizeModels');
const { sequelize } = require('./MeModule/ConnectDatabase');
const { Op } = require("sequelize");
const login = require('./MeModule/LoginIn');
const exp = require('./MeModule/ExportFile.js')

const express = require('express');
const cookieParser = require('cookie-parser');
const htmlDocx = require('html-docx-js');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const port = 4000;

//---------------------------------------------------------------------------------------------------------------------------------------------------------

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cookieParser());
app.use(express.json());
app.use('/', login);
app.use('/', exp)

//---------------------------------------------------------------------------------------------------------------------------------------------------------

var pasport;
function isAunth(req, res, next){
    const cookies = req.cookies;
    
    if(cookies){
        jwt.verify(cookies.name, 'petro-college', (err, decoded) => {
            if(decoded !== undefined){
                console.log(decoded) // bar
                pasport = decoded;
                next();
            }else{
                console.log('Not authorized!');
                res.redirect('/login');
            }
        });
    }else{
        console.log('Not cookies!');
        res.redirect('/login');
    }
}

function isStatus(req, res, next) {
    console.log(req.originalUrl);
    if(pasport.status == 'User')
        res.redirect('/');
    else if(pasport.status == 'Moderator' && req.originalUrl == '/export')
        res.redirect('/');
    next();
}

//---------------------------------------------------------------------------------------------------------------------------------------------------------

app.route('/')
.get(isAunth, (req, res) => {
    res.render('menu', {
        name: pasport.first_name, 
        group: pasport.group.realName,
        status: pasport.status
    });
});

app.route('/select')
.get(isAunth, isStatus, (req, res) => {
    res.render('select');
});

app.route('/send')
.get(isAunth, isStatus, async (req, res) => {
    var numberPar
    if(req.query.par < 1) {
        numberPar = 1;
    }else if (req.query.par > 6){
        numberPar = 6;
    }else{
        numberPar = req.query.par
    }

    var users;
    await Attendance.findOne({
        where: { 
            Date: new Date().toLocaleDateString('ko-KR'),
        },
        include: [{
            model: Groups,
            where: { 
                Name: pasport.group.realName 
            }
        }]
    }).then(async(result) => {
        console.log(JSON.stringify(result));
        if(!result){
            console.log('На сегоднешней день нет записи')
            await setGroupStatus(false)
            .then(async() => {
                users = await getUsersGroup();
            })
        }else{
            console.log('На сегоднешней день уже создана запись')
            await setGroupStatus(true)
        }
    });

    await Groups.findOne({
        where: {
            Name: pasport.group.realName
        }
    }).then((result) => {
        console.log(JSON.stringify(result))
        if(result){
            res.render('send', {
                allUsers: users,
                userLogin: pasport.login,
                group: pasport.group.realName,
                isDate: result.Status,
                numPar: numberPar
            }); 
            console.log(result.Status);
        }
    });
})
.post(isAunth, isStatus, async (req, res) => {
    var data = await req.body; 

    for(var key in data){
        var listJson = {};
        data[key].forEach((value, i) => {
            listJson['p' + i] = value;
        });

        await Attendance.create({
            Date: new Date().toLocaleDateString('ko-KR'),
            idGroup: pasport.group.foreignName,
            idUser: key,
            value: listJson
        });
    }

    await setGroupStatus(true);
    res.redirect('/send');

});

app.route('/update')
.get(isAunth, isStatus, async (req, res) => {
    var users = await getUsersGroup();
    await Attendance.findAll({
        where: {
            idGroup: pasport.group.foreignName,
            Date: new Date().toLocaleDateString('ko-KR'),
        },
        include: [{
            model: Users
        }]
    }).then((result) => {
        console.log(JSON.stringify(result));
        res.render('update', {
            allUsers: users,
            userLogin: pasport.login,
            group: pasport.group.realName,
            checks: result
        }); 
    });
})
.post(isAunth, isStatus, async (req, res) => {
    var data = await req.body; 

    for(var key in data){
        var listJson = {};
        data[key].forEach((value, i) => {
            listJson['p' + i] = value;
        });

        await Attendance.update({ value: listJson }, {
            where: {
                Date: new Date().toLocaleDateString('ko-KR'),
                idGroup: pasport.group.foreignName,
                idUser: key,
            }
        })
    }

    res.redirect('/update');
})

app.route('/show')
.get(isAunth, async (req, res) => {
    var users = await getUsersGroup();
    await Attendance.findAll({
        where: {
            idGroup: pasport.group.foreignName,
            Date: new Date().toLocaleDateString('ko-KR'),
        },
        include: [{
            model: Users
        }]
    }).then((result) => {
        console.log(JSON.stringify(result));
        res.render('show', {
            allUsers: users,
            userLogin: pasport.login,
            group: pasport.group.realName,
            checks: result
        }); 
    });
});

app.route('/export')
.get(isAunth, isStatus, async (req, res) => {
    await Groups.findAll({})
    .then(result => {
        console.log(JSON.stringify(result));
        res.render('export', {
            group: result
        })
    })
    .catch(err => console.log(err))
})
.post(isAunth, isStatus, async (req, res) => {
    var userDOCX;
    var valDOCX;
    var data = req.body;
    console.log(data);

    await Attendance.findAll({
        where: {
            Date: {
                [Op.between]: [new Date().toLocaleDateString('ko-KR'), data.dateWrite],
            },
            idGroup: +data.groupSelect
        }, 
        include: [{
            model: Users,
            where: {
                group: +data.groupSelect
            }
        }]
    })
    .then(async result => {
        await console.log(JSON.stringify(result));    
        await res.send(result);

        var array = [];

        //формирование нормального объекта json
        await result.forEach((obj, index) => {            
            array.push({
                idUser: obj.User.id,
                name: `${obj.User.first_name} ${obj.User.surname}`,
                Date: obj.dataValues.Date,
                dataVal: obj.dataValues.value
            })
        })

        //сортировка пользователей по возрастанию
        var s = array.sort(function(a, b) {
            if (a.idUser > b.idUser) {
                return 1;
            }
            if (a.idUser < b.idUser) {
            return -1;
            }
            return 0;
        })
   
        var user_json = {}; 
        s.forEach(obj => {
            user_json[obj.idUser] = {};
        })

        var iterate = 0;
        var arr_date = {};
        s.forEach(obj => {
            for(var key in user_json){
                if(obj.idUser == key){
                    arr_date[obj.Date] = obj.dataVal;
                }else{
                    continue;
                }
                iterate++;

                if(iterate == 6){
                    user_json[obj.idUser] = {
                        name: obj.name,
                        dateValues: arr_date
                    }

                    // console.log(user_json[key].dateValues)
                    iterate = 0;
                    arr_date = {}
                    break;
                }
            }
        })

        console.log(user_json)
        for(var key in user_json){
            var count_H = 0;
            var count_Y = 0;
            var arr_par = [];
            valDOCX = '';

            for(var key2 in user_json[key].dateValues){
                var i = 0;
                for(var item in user_json[key].dateValues[key2]){
                    arr_par.push(user_json[key].dateValues[key2][item])

                    var params = user_json[key].dateValues[key2][item];
                    if(params == 'H'){
                        count_H++;
                    }else if(params == 'Y'){
                        count_Y++;
                    }
                    i++;
                }
                for(var t = i; t < 5; t++){
                    arr_par.push("  ")
                }
            }
            
            arr_par.forEach(val =>{
                valDOCX += `<td width="100" align="center" valign="center" >${val}</td>`
            })

            valDOCX += `<td align="center" valign="center" >${count_H}</td>`
            valDOCX += `<td align="center" valign="center" >${count_Y}</td>`

            userDOCX += `<tr id="${key}"> <td>${user_json[key].name}</td> ${valDOCX}</tr>`
        }         

        var DOCX = `<!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
        </head>
        <body>
        <style>
        body{
        
        }
        table{
        border-collapse: collapse;
        height: 1140px;
        width: 1054px;
        }
        tr{
        border: 1px solid black;
        }
        td{
        border: 1px solid black;

        }
        </style>

        <div class="header">

        </div>
        <p>

        </p>
        <table>
        <tr>
        <td width="20%" align="center"><h1>группа №${data.nameGroup}</h1></td>
        <td colspan="30" width="60%" align="center" valign="bottom">Посещение занятий студентами с ${new Date().toLocaleDateString('ru-RU')}. по ${ new Date(data.dateWrite).toLocaleDateString('ru-RU')}.</td>
        <td colspan="2" align="center" width="20%"><h1>Октябрь, 2021</h1></td>
        </tr>
        <tr>
        <td>Дни недели</td>
        <td align="center" colspan="5" width="10%">Понедельник</td>
        <td align="center" colspan="5" width="10%">Вторник</td>
        <td align="center" colspan="5" width="10%">Среда</td>
        <td align="center" colspan="5" width="10%">Четверг</td>
        <td align="center" colspan="5" width="10%">Пятница</td>
        <td align="center" colspan="5" width="10%">Суббота</td>
        <td align="center" colspan="2">Всего пропусков</td>
        </tr>
        <tr id="data-zan">
        <!— Заполняем циклом —>
        </tr>
        <tr>
        <td height="150">Наименование дисциплины</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td>По уважительным причинам (кол-во часов)</td>
        <td>По неуважительным причинам (кол-во часов)</td>
        </tr>
           ${userDOCX}
        </table>
        <script>
        var dateZan = document.getElementById("data-zan");

        function exploitDate(){

        dateZan.innerHTML="<td>Дата занятий</td>";
        for (var i = 0; i<6; i++){
        dateZan.innerHTML += "<td colspan='5' align='center'>0"+(i+1)+".06.2021" +"</td>";
        }

        }

        exploitDate();
        </script>
        </body>
        </html>`

        var content = await htmlDocx.asBlob(DOCX, {orientation: 'landscape', margins: {left: 100, top: 100, right: 100}});
        await fs.writeFileSync("index.docx", content, (error, data) => {
            if(error) throw error;
            console.log("GOOD!")
        })

    })
    .catch(err => console.log(err))
})

//---------------------------------------------------------------------------------------------------------------------------------------------------------

async function setGroupStatus(s){
    await Groups.update({ Status: s }, {
        where: {
            Name: pasport.group.realName
        }
    }).then((result) => {
        console.log(JSON.stringify(result));
    });
}

async function getUsersGroup(){
    var all_users;
    await Users.findAll({
        where: { group: pasport.group.foreignName }, 
        include: [{ 
            model: Groups
        }]
    }).then((result) => {
        console.log(JSON.stringify(result));
        all_users = result
    });
    return all_users
}

//---------------------------------------------------------------------------------------------------------------------------------------------------------

sequelize.sync({})
.then(() => {
    app.listen(port, () => {
        console.log(`Start server: ${port}`);
    });
});