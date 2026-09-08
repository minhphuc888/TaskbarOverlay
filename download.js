const https = require('https');
const fs = require('fs');

const file = fs.createWriteStream("lunar.js");
https.get("https://cdn.jsdelivr.net/npm/lunar-javascript/lunar.js", function(response) {
  response.pipe(file);
  file.on("finish", () => {
    file.close();
    console.log("Download completed");
  });
});
