const fs = require('fs');

const content = fs.readFileSync('src/modules/admin/admin.handler.ts', 'utf-8');
const lines = content.split('\n');

let opens = 0;
let closes = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const opensInLine = (line.match(/{/g) || []).length;
  const closesInLine = (line.match(/}/g) || []).length;

  opens += opensInLine;
  closes += closesInLine;
  const balance = opens - closes;

  // Print around line 3837
  if (i + 1 >= 3820 && i + 1 <= 3850) {
    console.log(
      `Line ${i + 1}: +${opensInLine} -${closesInLine} = balance:${balance} | ${line.substring(0, 80)}`,
    );
  }

  if (balance < 0) {
    console.log(`\n*** ERROR Line ${i + 1}: NEGATIVE BALANCE ${balance} ***`);
    break;
  }
}

console.log(
  `\nFinal: ${opens} opens, ${closes} closes, balance: ${opens - closes}`,
);
