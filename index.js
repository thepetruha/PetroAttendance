const { Users, Attendance, Groups} = require('./MeModule/SequelizeModels');
const { sequelize } = require('./MeModule/ConnectDatabase');
const { Op } = require("sequelize");
const login = require('./MeModule/LoginIn');
const exp = require('./MeModule/ExportFile.js');
const express = require('express');
const cookieParser = require('cookie-parser');
const htmlDocx = require('html-docx-js');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { count } = require('console');

const app = express();
const port = 4000;
//const xlsx = require('node-xlsx');
//---------------------------------------------------------------------------------------------------------------------------------------------------------

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cookieParser());
app.use(express.json());
app.use('/', login);
app.use('/', exp)
//---------------------------------------------------------------------------------------------------------------------------------------------------------
var pasport;
/* =============  ПРОВЕРКА НА АВТОРИЗАЦИЮ ЧЕРЕЗ КУКИ ====================*/
function isAunth(req, res, next){
    const cookies = req.cookies;   
    if(cookies){
        jwt.verify(cookies.name, 'petro-college', (err, decoded) => {
            if(decoded !== undefined){
                //console.log(decoded) // bar
                pasport = decoded;
                next();
            }else{
                console.log('Не авторизован!');
                res.redirect('/login');
            }
        });
    }else{
        console.log('Не принес печеньки...');
        res.redirect('/login');
    }
}
/* =============  ФУНКЦИЯ ПРОВЕРКИ НА СТАТУС ПОЛЬЗОВАТЕЛЯ (АДМИН, МОДЕРАТОР И ОБЫЧНЫЙ ПОЛЬЗОВАТЕЛЬ)====================*/
function isStatus(req, res, next) {
    //console.log(req.originalUrl);
    if(pasport.status == 'User')
        res.redirect('/');
    else if(pasport.status == 'Moderator' && req.originalUrl == '/export')
        res.redirect('/');
    next();
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/* =============  ГЛАВНОЕ МЕНЮ ====================*/
app.route('/')
.get(isAunth, (req, res) => {
    res.render('menu', {
        name: pasport.first_name, 
        group: pasport.group.realName,
        status: pasport.status
    });
});

/* =============  ВЫБОР КОЛИЧЕСТВА ПАР НА СЕГОДНЯШНИЙ ДЕНЬ ====================*/
app.route('/select')
.get(isAunth, isStatus, async (req, res) => {
    isDates = await getIsDate();
    res.render('select', {
        isDate: isDates,
        group: pasport.group.realName,
    }); 
});

/* ============= СОЗДАНИЕ ПОСЕЩАЕМОСТИ НА СЕГОДНЯШНИЙ ДЕНЬ ====================*/
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
        if(!result){ // на сегодня нет записи
            await setGroupStatus(false)
            .then(async() => {
                users = await getUsersGroup();
            })
        }else{//На сегодня создана запись
            await setGroupStatus(true)
        }
    });
    await Groups.findOne({
        where: {
            Name: pasport.group.realName
        }
    }).then((result) => {
        if(result){
            res.render('send',  {
                allUsers: users,
                userLogin: pasport.login,
                group: pasport.group.realName,
                isDate: result.Status,
                numPar: numberPar
            }); 
        }
    });
})
.post(isAunth, isStatus, async (req, res) => {
    var data = req.body; 
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
    await setGroupStatus(true).then(() => {
        res.redirect('/success');
    })

});
/* =============  РЕДАКТИРОВАНИЕ ПОСЕЩЯЕМОСТИ НА СЕГОДНЯШНИЙ ДЕНЬ ====================*/
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
    }).then(async (result) => {
        isDates = await getIsDate();
        res.render('update', {
            allUsers: users,
            userLogin: pasport.login,
            group: pasport.group.realName,
            checks: result,
            isDate: isDates
        }); 
    });
})
.post(isAunth, isStatus, async (req, res) => {
    var data = req.body; 

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
    
    res.redirect(302, '/success');
})

app.route('/success')
.get(isAunth, isStatus, (req, res) => {
    res.render('success', {
        group: pasport.group.realName
    });
})
/* =============  ПРОСМОТР ПОСЕЩАЕМОСТИ НА СЕГОДНЯШНИЙ ДЕНЬ ====================*/
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
    }).then(async (result) => {
        isDates = await getIsDate();
        res.render('show', {
            allUsers: users,
            userLogin: pasport.login,
            group: pasport.group.realName,
            checks: result,
            isDate: isDates
        }); 
    });
});
/* =============  ИМПОРТ НОВЫХ СТУДЕНТОВ ИЗ EXCEL ФАЙЛА ====================*/
const urlencodedParser = express.urlencoded({extended: false});
app.route('/import')
.get(isAunth, isStatus, async (req, res) => {
    //console.log(req.body);
    /*const workSheetsFromFile = xlsx.parse(`${__dirname}/group.xlsx`);
        workSheetsFromFile.forEach(obj => {
            console.log(obj.data);
            for (var i = 0; i <= obj.data.length; i++){
                console.log(obj.data[i]);
            }
        });*/
    res.render('import');
    
})
.post(isAunth,urlencodedParser, isStatus, async (request, response) => {
    if(!request.body) return response.sendStatus(400);
    response.send(`${request.body.groupName} - ${request.body.importFile}`);
});
/* =============  ЭКСПОРТ ПОСЕЩАЕМОСТИ В WORD ДОКУМЕНТ ====================*/
app.route('/export')
.get(isAunth, isStatus, async (req, res) => {
    await Groups.findAll({})
    .then(result => {
        res.render('export', {
            group: result
        })
    })
    .catch(err => console.log(err))
})
.post(isAunth, isStatus, async (req, res) => {
    var userDOCX;
    var valDOCX;
    var beforeDays = "";
    var afterDays = "";
    var dateZanatya = ``;
    var data = req.body;
    console.log("======== ДАННЫЕ СО СТРАНИЦЕ ПРИ ЭКСПОРТЕ ===============================");
    console.log(data);
    console.log("_______________________________________________");

    await Attendance.findAll({
        where: {
            Date: {
                [Op.between]: [data.dateWriteFirst, data.dateWriteSecond],
            },
            idGroup: +data.groupSelect
        }, 
        order: [
            ['Date', 'ASC']
        ],
        include: [{
            model: Users,
            where: {
                group: +data.groupSelect
            }
        }]
    })
    .then(async result => {
        var array = [];
        var dates = {

        };
        var ForceDateArray = [];
        const datesInputClient = [new Date(data.dateWriteFirst), new Date(data.dateWriteSecond)];
        if((datesInputClient[1].getDate() - datesInputClient[0].getDate()) > 0){
            var curentNumDate = datesInputClient[1].getDate() - datesInputClient[0].getDate();
            for(var t = 1; t <= curentNumDate + 1; t++){
                var d1 = datesInputClient[0];
                console.log(d1.toISOString().split("T")[0])
                ForceDateArray.push(d1.toISOString().split("T")[0])
                d1 = new Date(d1.setDate(d1.getDate() + 1)).toISOString().split("T")[0];
            }
        }

        result.forEach((obj,index) => {          
            array.push({
                idUser: obj.User.id,
                name: `${obj.User.first_name} ${obj.User.surname}`,
                Date: obj.dataValues.Date,
                dataVal: obj.dataValues.value
            })

            dates[obj.dataValues.Date] = {};
        });


        //придумать как взять даты которых нет в основном массиве (array)
        //и просто в этом месте запушить их в массив array

        //вот так
        //--> // array.push({
            //     idUser: obj.User.id,
            //     name: `${obj.User.first_name} ${obj.User.surname}`,
            //     Date: obj.dataValues.Date,
            //     dataVal: obj.dataValues.value
            // })

        var g;
        for(var key = 0; key < ForceDateArray.length; key++) {
            if(ForceDateArray[key] !== g){
                array.forEach(user => {
                    console.log(ForceDateArray.includes(user.Date))
                    g = user.Date
                })
            }else{
                continue;
            }
        }
    
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
        //новый json для сортировки дат
        //1. заносим id пользователей
        s.forEach(obj => {
            user_json[obj.idUser] = {};            
        })

/* ЗАПОЛНЯЕМ ПУСТЫЕ КЛЕТОЧКИ ДО И ПОСЛЕ Н-ОК*/
        var firstDay = new Date(data.dateWriteFirst).getDay(); // день недели первой выбранной даты: 3 - среда и тд
        var lastDay = new Date(data.dateWriteSecond).getDay();
        var dayCount = 5; //Количество пар в день максимально 
        var beforeDateZanyatya = '';
        var afterDateZanyatya = '';
        
        var iterate = 0;
        var arr_date = {};
        var check = lastDay-firstDay+1;
        var countDays = []; // Счетчик дней по итогу

        if (firstDay>1){ // Если первый день недели больше понедельника, то вперед вставляем пустые клетки
            for(var i = 1; i<firstDay; i++){
                for(var j = 0; j<dayCount; j++){
                beforeDays += `<td width="100" align="center" valign="center"></td>`;
            }
            beforeDateZanyatya+=`<td colspan="5" width="100" align="center" valign="center"></td>`;
        }
    }

    if (lastDay<7){ // Если второй день недели меньше субботы, то в конец добавляем пустые клетки
        for(var i = 1; i<7-lastDay; i++){
            for(var j = 0; j<dayCount; j++){
                afterDays += `<td width="100" align="center" valign="center"></td>`;
            }
            afterDateZanyatya+=`<td colspan="5" width="100" align="center" valign="center"></td>`;
        }
    }

    dateZanatya = `<td>Дата занятий</td>`+ beforeDateZanyatya;

    s.forEach(obj=>{
        for(var i=0; i<check; i++){
            if (!countDays.includes(obj.Date)) {
                // если нет даты такой в массиве, то добавляем
                countDays.push(obj.Date);
            }else{
               // countDays.push(obj.Date);
            }  
        }
    })
    s.forEach(obj => {   
        for(var key in user_json){
            //каждому пользователю дабавляем даты которые пресутствуют у него
            if(obj.idUser == key){
                arr_date[obj.Date] = obj.dataVal;
            }else{
                continue;
            }
            iterate++;

            if(iterate == countDays.length){
                user_json[obj.idUser] = {
                    name: obj.name,
                    dateValues: arr_date
                }
                console.log(user_json[obj.idUser].dateValues);
                iterate = 0;
                arr_date = {}
                break;
            }
        }
    });

        for(var key in user_json){
            var count_H = 0;
            var count_Y = 0;
            var arr_par = [];
            var params;
            valDOCX = '';
            for(var key2 in user_json[key].dateValues){
                var i = 0;
                for(var item in user_json[key].dateValues[key2]){
                    arr_par.push(user_json[key].dateValues[key2][item])

                    params = user_json[key].dateValues[key2][item];
                    if(params == 'Н'){
                        count_H++;
                    }else if(params == 'У'){
                        count_Y++;
                    }
                    i++;
                }
                for(var t = i; t < 5; t++){
                    arr_par.push("")
                }
            }
            
            valDOCX += beforeDays;
            
            
            arr_par.forEach(val =>{
                valDOCX += `<td width="100" align="center" valign="center" >${val}</td>`;
            })
            valDOCX += afterDays;
            valDOCX += `<td align="center" valign="center" >${count_Y}</td>`;
            valDOCX += `<td align="center" valign="center" >${count_H}</td>`;
            
            userDOCX += `<tr id="${key}"><td>${user_json[key].name}</td>${valDOCX}</tr>`;
            
        }         
        
        for (const key in dates) {
            dateZanatya+= `<td colspan="5" align="center" valign="center">`;
            dateZanatya+= new Date(key).toLocaleDateString("ru-RU");
            dateZanatya+=`</td>`; 
        }
        
        var options = { month: 'long', year: 'numeric' };
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
        .border-top{
            border-top: 5px solid black;
        }
        .border-left{
            border-left: 5px solid black;
        }
        .border-bottom{
            border-bottom: 5px solid black;
        }
        .border-right{
            border-right:  5px solid black;
        }
        table{
            margin-top: 40px;
            border-collapse: collapse;
            height: 1140px;
            width: 900px;
            margin-left: 70px;
        }
        #main td{
            border: 1px solid black
        }
        #main tr{ border: 1px solid black }
        #main tr.none-border, #main tr.none-border td{ border: 0px  }

        </style>
        <table id="main">
        <tr class="none-border">
        <td width="18%" align="center"><h2>группа №${data.nameGroup}</h2></td>
        <td colspan="30" width="52%" align="center" valign="bottom"><p>Посещение занятий студентами с ${new Date(data.dateWriteFirst).toLocaleDateString('ru-RU')}. по ${new Date(data.dateWriteSecond).toLocaleDateString('ru-RU')}.</p></td>
        <td colspan="2" align="center" width="18%"><h2>${new Date(data.dateWriteFirst).toLocaleDateString('ru-RU', options)}</h2></td>
        </tr>
        <tr>
        <td class="border-top border-left"><p>Дни недели</p></td>
        <td align="center" colspan="5" width="10%" class="border-left border-right"><p>Понедельник</p></td>
        <td align="center" colspan="5" width="10%"><p>Вторник</p></td>
        <td align="center" colspan="5" width="10%"><p>Среда</p></td>
        <td align="center" colspan="5" width="10%"><p>Четверг</p></td>
        <td align="center" colspan="5" width="10%"><p>Пятница</p></td>
        <td align="center" colspan="5" width="10%"><p>Суббота</p></td>
        <td align="center" colspan="2"><p>Всего пропусков</td>
        </tr>
        <tr id="data-zan">
        <p>
        ${dateZanatya + afterDateZanyatya}
        </p>
        <td colspan="2"></td>
        </tr>
        <tr>
        <td height="150"><p>Наименование дисциплины</p></td>
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
        <td><p>По уважительным причинам (кол-во часов)</p></td>
        <td><p>По неуважительным причинам (кол-во часов)</p></td>
        </tr>
            <p> ${userDOCX} </p>
        <tr>
        </tr>
        </table>
        <table>
            <td align="center">
                <p>Куратор _________   ______________</p>
            </td>
            <td align="center">
            <p>Староста _________   ______________</p>
            </td>
        </table>
        </body>
        </font>
        </html>`
        var content = htmlDocx.asBlob(DOCX, {orientation: 'landscape', margins: {left: 100, top: 100, right: 100}, font:'Times New Roman'});
        fs.writeFileSync("index.docx", content, (error, data) => {
            if(error) throw error;
        })
    })
    .catch(err => console.log(err))
})
/* =============  СКАЧИВАНИЕ СФОРМИРОВАННОГО WORD ДОКУМЕНТА ====================*/
app.get('/download', function(req, res){
    const file = `${__dirname}/index.docx`;
    res.download(file); // 
  });
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/* =============  НЕ ЗНАЮ, ПЕТР. ЧТО ЭТО ? ====================*/
async function setGroupStatus(s){
    await Groups.update({ Status: s }, {
        where: {
            Name: pasport.group.realName
        }
    })//.then((result) => {
        //console.log(JSON.stringify(result));
   // });
}
/* =============  ПОЛУЧЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ С УКАЗАННОЙ ГРУППОЙ ====================*/
async function getUsersGroup(){
    var all_users;
    await Users.findAll({
        where: { group: pasport.group.foreignName }, 
        include: [{ 
            model: Groups
        }]
    }).then((result) => {
        //console.log(JSON.stringify(result));
        all_users = result
    });
    return all_users
}
/* =============  ПРОВЕРКА НА СОЗДАННОСТЬ ПОСЕЩЕНИЙ ====================*/
async function getIsDate(){
    var isDate;
    
    await Groups.findOne({
        where: {
            Name: pasport.group.realName
        }
    }).then((result) => {
        isDate = result.Status;
        
    });
   
    return isDate;
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/* =============  ЗАПУСК СЕРВЕРА ====================*/
sequelize.sync({})
.then(() => {
    app.listen(port, () => {
        console.log(`Start server: ${port}`);
    });
});