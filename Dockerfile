FROM mcr.microsoft.com/playwright:v1.56.1-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV HEADLESS=true

CMD ["npm", "start"]
