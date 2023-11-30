import fs from 'node:fs';
import readCsv from '../readCsv.js';

console.log(readCsv('臺北市垃圾資源回收、廚餘回收限時收受點.csv',[
    'area',
    'team',
    'phone',
    'address',
    'note',
    'longitude',
    'latitude'
]));

