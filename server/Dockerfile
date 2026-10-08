FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
RUN apk add --no-cache su-exec
COPY index.js policy.js start.sh ./
RUN chmod +x /app/start.sh
ENV NODE_ENV=production
EXPOSE 8080
ENTRYPOINT ["/app/start.sh"]
CMD ["node", "index.js"]

