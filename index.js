const { Users, Attendance, Groups } = require('./MeModule/SequelizeModels');
const { sequelize } = require('./MeModule/ConnectDatabase');
const { Op } = require("sequelize");
const login = require('./MeModule/LoginIn');
const exp = require('./MeModule/ExportFile.js');
const express = require('express');
const cookieParser = require('cookie-parser');
const htmlDocx = require('html-docx-js');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const port = 4001;
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
function isAunth(req, res, next) {
    const cookies = req.cookies;
    if (cookies) {
        jwt.verify(cookies.name, 'petro-college', (err, decoded) => {
            if (decoded !== undefined) {
                //console.log(decoded) // bar
                pasport = decoded;
                next();
            } else {
                console.log('Не авторизован!');
                res.redirect('/login');
            }
        });
    } else {
        console.log('Не принес печеньки...');
        res.redirect('/login');
    }
}
/* =============  ФУНКЦИЯ ПРОВЕРКИ НА СТАТУС ПОЛЬЗОВАТЕЛЯ (АДМИН, МОДЕРАТОР И ОБЫЧНЫЙ ПОЛЬЗОВАТЕЛЬ)====================*/
function isStatus(req, res, next) {
    //console.log(req.originalUrl);
    if (pasport.status == 'User')
        res.redirect('/');
    else if (pasport.status == 'Moderator' && req.originalUrl == '/export')
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
        if (req.query.par < 1) {
            numberPar = 1;
        } else if (req.query.par > 6) {
            numberPar = 6;
        } else {
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
        }).then(async (result) => {
            //console.log(JSON.stringify(result));
            if (!result) {
                //console.log('На сегодня нет записи')
                await setGroupStatus(false)
                    .then(async () => {
                        users = await getUsersGroup();
                    })
            } else {
                //console.log('На сегоднешней день уже создана запись')
                await setGroupStatus(true)
            }
        });
        await Groups.findOne({
            where: {
                Name: pasport.group.realName
            }
        }).then((result) => {
            //console.log(JSON.stringify(result))
            if (result) {
                res.render('send', {
                    allUsers: users,
                    userLogin: pasport.login,
                    group: pasport.group.realName,
                    isDate: result.Status,
                    numPar: numberPar
                });
                //console.log(result.Status);
            }
        });
    })
    .post(isAunth, isStatus, async (req, res) => {
        var data = req.body;
        //console.log(data)

        for (var key in data) {
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
            // console.log(JSON.stringify(result));
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
        //console.log('------------------------------------------------------------------- ^')
        //console.log(data)
        //console.log("DATA KEYSSS ")

        for (var key in data) {
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

        //console.log('REDIRECTED');
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
            //console.log(JSON.stringify(result));
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
const urlencodedParser = express.urlencoded({ extended: false });
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
    .post(isAunth, urlencodedParser, isStatus, async (request, response) => {
        if (!request.body) return response.sendStatus(400);
        //console.log(request.body);
        response.send(`${request.body.groupName} - ${request.body.importFile}`);
    });

/* =============  ЭКСПОРТ ПОСЕЩАЕМОСТИ В WORD ДОКУМЕНТ ====================*/
app.route('/export')
    .get(isAunth, isStatus, async (req, res) => {
        await Groups.findAll({})
            .then(result => {
                //console.log("======== ВСЕ ГРУППЫ ================================");
                //console.log(JSON.stringify(result));
                //console.log("____________________________________________________");
                res.render('export', {
                    group: result
                })
            })
            .catch(err => console.log(err))
    })
    .post(isAunth, isStatus, async (req, res) => {
        var data = req.body
        var userDOCX = "";
        var valDOCX = "";
        var afterDays = ""
        var dateZanatya = `<td>Дата занятий</td>`
        console.log("======== ДАННЫЕ СО СТРАНИЦЕ ПРИ ЭКСПОРТЕ ===============================");

        await Attendance.findAll({
            where: {
                Date: {
                    [Op.between]: [data.dateWriteFirst, data.dateWriteSecond],
                },
                idGroup: +data.groupSelect,
            },
            order: [
                ['Date', 'ASC']
            ],
            include: [{
                model: Users,
                where: {
                    group: +data.groupSelect
                }
            }],
        })
            .then(async (attendance) => {
                if(attendance.length == 0) return res.send({result: -1});
                attendance = attendance.map(({ idUser, User, Date, value }) => {
                    return {
                        name: `${User.first_name} ${User.surname}`,
                        idUser,
                        Date,
                        value
                    }
                })

                console.log(attendance);

                var groupAttendanceByDate = attendance => {
                    const groupedAttendance = {}
                    if (attendance.rowCount == 0) {
                        return {};
                    }else{
                        attendance.forEach(obj => {
                            const group = groupedAttendance[obj.Date]
                            group ? group.push(obj) : groupedAttendance[obj.Date] = [obj]
                        })

                        return groupedAttendance
                    }
                }

                var getStartWeekDate = _date => {
                    const date = new Date(_date)
                    const day = date.getDay() || 7

                    if (day !== 1) date.setDate(date.getDate() - (day - 1))

                    return date
                }

                var addDays = (date, days) => {
                    const result = new Date(date);
                    result.setDate(result.getDate() + days);
                    return result;
                }

                var getEmptyAttendance = (groupedAttendance, Date) => {
                    const keys = Object.keys(groupedAttendance)
                    const [...arr] = groupedAttendance[keys[0]]
                    const pairsLength = Object.keys(arr[0].value).length

                    return arr.map(atndc => {
                        const value = {}
                        for (let i = 0; i <= pairsLength; i++) {
                            value['p' + i] = ''
                        }

                        return { Date, value, idUser: atndc.idUser, name: atndc.name }
                    })

                }

                var startWeekDate = getStartWeekDate(attendance[0].Date)
                var groupedAttendance = groupAttendanceByDate(attendance)

                for (let i = 0; i < 6; i++) {
                    const date = addDays(startWeekDate, i)
                    const formatedDate = date.toLocaleDateString('us').split('.').reverse().join('-')

                    dateZanatya += `<td colspan="5" align="center" valign="center">`;
                    dateZanatya += new Date(date).toLocaleDateString("ru-RU");
                    dateZanatya += `</td>`;

                    if (!groupedAttendance.hasOwnProperty(formatedDate)) {
                        groupedAttendance[formatedDate] = getEmptyAttendance(groupedAttendance, formatedDate)
                    }
                }

                const s = Object.entries(groupedAttendance)
                    .map(([, array]) => array)
                    .flat()
                    .sort((a, b) => a.idUser - b.idUser || new Date(a.Date) - new Date(b.Date))

                var user_json = {};
                s.forEach(obj => {
                    user_json[obj.idUser] = {};
                })
                console.log(s)
                console.log(user_json)

                var firstDay = new Date(data.dateWriteFirst).getDay();
                var lastDay = new Date(data.dateWriteSecond).getDay();

                var iterate = 0;
                var arr_date = {};
                var check = lastDay - firstDay + 1;
                s.forEach(obj => {
                    for (var key in user_json) {
                        if (obj.idUser == key) {
                            arr_date[obj.Date] = obj.value;
                        } else {
                            continue;
                        }
                        iterate++;

                        if (iterate == check) {
                            user_json[obj.idUser] = {
                                name: obj.name,
                                dateValues: arr_date
                            }
                            iterate = 0;
                            arr_date = {}
                            break;
                        }
                    }
                });

                for (var key in user_json) {
                    var count_H = 0;
                    var count_Y = 0;
                    var arr_par = [];
                    valDOCX = '';
                    for (var key2 in user_json[key].dateValues) {
                        var i = 0;
                        for (var item in user_json[key].dateValues[key2]) {
                            arr_par.push(user_json[key].dateValues[key2][item])
                            const params = user_json[key].dateValues[key2][item];
                            if (params == 'Н') {
                                count_H++;
                            } else if (params == 'У') {
                                count_Y++;
                            }
                            i++;
                        }
                        for (var t = i; t < 5; t++) {
                            arr_par.push("  ")
                        }
                    }

                    arr_par.forEach(val => valDOCX += `<td width="100" align="center" valign="center" >${val}</td>`)
                    valDOCX += afterDays;
                    valDOCX += `<td align="center" valign="center" >${count_Y * 2}</td>`;
                    valDOCX += `<td align="center" valign="center" >${count_H * 2}</td>`;
                    userDOCX += `<tr id="${key}"><td>${user_json[key].name}</td>${valDOCX}</tr>`;
                }

                const options = { month: 'long', year: 'numeric' };
                const DOCX = `<!DOCTYPE html>
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

                                </style>
                                <font size="5" color="red" face="Times New Roman">
                                <div class="header">

                                </div>
                                <p>

                                </p>
                                <table id="main">
                                <tr>
                                <td width="18%" align="center"><h2>группа №${data.nameGroup}</h2></td>
                                <td colspan="30" width="52%" align="center" valign="bottom">Посещение занятий студентами с ${new Date(data.dateWriteFirst).toLocaleDateString('ru-RU')}. по ${new Date(data.dateWriteSecond).toLocaleDateString('ru-RU')}.</td>
                                <td colspan="2" align="center" width="18%"><h2>${new Date(data.dateWriteFirst).toLocaleDateString('ru-RU', options)}</h2></td>
                                </tr>
                                <tr>
                                <td class="border-top border-left">Дни недели</td>
                                <td align="center" colspan="5" width="10%" class="border-left border-right">Понедельник</td>
                                <td align="center" colspan="5" width="10%">Вторник</td>
                                <td align="center" colspan="5" width="10%">Среда</td>
                                <td align="center" colspan="5" width="10%">Четверг</td>
                                <td align="center" colspan="5" width="10%">Пятница</td>
                                <td align="center" colspan="5" width="10%">Суббота</td>
                                <td align="center" colspan="2">Всего пропусков</td>
                                </tr>
                                <tr id="data-zan">
                                ${dateZanatya}
                                <td colspan="2"></td>
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
                                <tr>
                                
                                </tr>
                                </table>
                                <table>
                                    <td align="center">
                                        Куратор _________   ______________
                                    </td>
                                    <td align="center">
                                        Староста _________   ______________
                                    </td>
                                </table>
                                </body>
                                </font>
                                </html>`
                var content = htmlDocx.asBlob(DOCX, { orientation: 'landscape', margins: { left: 100, top: 100, right: 100 } });

                fs.writeFileSync("index.docx", content, (error, data) => {
                    if (error) throw error;
                })
            })
            .catch(err => console.log(err))
    })
/* =============  СКАЧИВАНИЕ СФОРМИРОВАННОГО WORD ДОКУМЕНТА ====================*/
app.get('/download', function (req, res) {
    const file = `${__dirname}/index.docx`;
    res.download(file); // 
});
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/* =============  НЕ ЗНАЮ, ПЕТР. ЧТО ЭТО ? ====================*/
async function setGroupStatus(s) {
    await Groups.update({ Status: s }, {
        where: {
            Name: pasport.group.realName
        }
    }).then((result) => {
        //console.log(JSON.stringify(result));
    });
}
/* =============  ПОЛУЧЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ С УКАЗАННОЙ ГРУППОЙ ====================*/
async function getUsersGroup() {
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
async function getIsDate() {
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