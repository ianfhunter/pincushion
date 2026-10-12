Self-hosted PinCushion service.

When using Docker, clean up temporary images you create. Scope `docker compose down` to this project only.

Namespace environment variables with `PINCUSHION_` to avoid conflicts with other stacks.

After any change that should be live in the running app (code, docs, frontend, config baked into the image), always rebuild and reload this project’s container — e.g. `docker compose up -d --build` from `containers/pincushion` — without waiting to be asked. Confirm the container is healthy.
