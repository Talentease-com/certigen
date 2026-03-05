import { definePlugin } from "nitro";
import { useStorage } from "nitro/storage";
import fsDriver from "unstorage/drivers/fs";

export default definePlugin(() => {
  const storage = useStorage();

  storage.mount(
    "templates",
    fsDriver({
      base: process.env.TEMPLATES_DIR ?? "./data/templates",
    }),
  );

  storage.mount(
    "certificates",
    fsDriver({
      base: process.env.CERTIFICATES_DIR ?? "./data/certificates",
    }),
  );
});
