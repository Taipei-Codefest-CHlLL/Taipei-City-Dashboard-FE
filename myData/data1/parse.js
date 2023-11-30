const fs = require('node:fs');

// for (let i = 95; i < 112; i++) {
//     let file = fs.readFileSync(i + '年各區清潔隊資源回收量.csv').toString();
//     file = file.replace(/\r?\n臺北市政府環境保護局\d+年各區清潔隊資源回收量統計表\r?\n單位：公噸/, '');
//     file = file.replace(/,/g, '');
//     file = file.replace(/ /g, ',');
//     file = file.replace(/區隊/g, '區');
//     fs.writeFileSync(i + '年各區清潔隊資源回收量.csv', file);
// }