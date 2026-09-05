# gmfy hub server: `docker build -t gmfy-hub hub && docker run -p 8787:8787 -v hubdata:/data gmfy-hub`
FROM node:22-alpine
WORKDIR /hub
COPY server ./server
COPY client ./client
ENV PORT=8787 HUB_DATA=/data/hub.json NODE_ENV=production
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "server/index.js"]
