const fs = require('fs');
const path = require('path');

async function main() {
  const sharp = require('sharp');
  const input = path.join(process.cwd(), 'public', 'icon-512x512.svg');
  const outputs = [
    { name: 'notification-icon-192.png', size: 192 },
    { name: 'notification-icon-512.png', size: 512 },
  ];

  for (const output of outputs) {
    await sharp(input)
      .resize(output.size, output.size)
      .png()
      .toFile(path.join(process.cwd(), 'public', output.name));
  }

  fs.writeFileSync(path.join(process.cwd(), 'public', 'notification-badge-96.png'), Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAAXNSR0IArs4c6QAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAABgUlEQVR4nO3bMQ6CQBBF0Q8L9/8vW0cKqUK4RHFgaRSbuuSSMzdON3NofM8BAAAAAAAAAAD4D8sra9vH9f1fWkLtK2W4s3w7Pq9N2rJ3u2k5b8v7E2WQm2l8hYzCq8kNnC+7Y4GJH6u9v3db6JXgN1v8P7M6t2H6g0Q9wNZi3r3w6gUQ7wNbi3p3w6gUQ7wNbi3p3w6gUQ7wNbi3p3w6gUQ7wNbi3p3w6gUQ7wNbi3p3w6gUQ7wNbi3p3w6gUQ7wNbi3p3w6gUQ7wNbj3W7y7m8yW3s7M2lK6V6s7y2m3p9Qz2UeV6m7b9gN4r1Y8e6z3b6l1g8wD7g5mWmJmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZ+Qf7A4kzH9mQ7f8AAAAASUVORK5CYII=',
    'base64'
  ));

  console.log('notification icons generated');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
