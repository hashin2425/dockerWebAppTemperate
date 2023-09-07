# Build Vue.js frontend
FROM node:lts AS build-stage
WORKDIR /app
COPY /frontend/package*.json ./
RUN npm install
COPY /frontend .
RUN npm run build

# Setup server
FROM node:lts
WORKDIR /app
COPY /backend/package*.json ./
RUN npm install
COPY /backend .
COPY --from=build-stage /app/dist ./public
EXPOSE 3000
CMD ["node", "server.js"]