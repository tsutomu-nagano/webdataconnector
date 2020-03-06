

FROM node:12.14.1

COPY /data /data

CMD ["node","/data/app.js"]