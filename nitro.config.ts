import { defineNitroConfig } from 'nitro/config';

export default defineNitroConfig({
  // storage: {
  //   persistent: {
  //     driver: 's3',
  //     bucket: process.env.S3_BUCKET,
  //     accessKeyId: process.env.S3_ACCESS_KEY_ID,
  //     secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  //   }
  // },
  // devStorage: {
  //   persistent: {
  //     driver: 'fs',
  //     base: './data'
  //   }
  // }
});