# Self-host friendly: runs Next.js in dev so NEXT_PUBLIC_* are read from the
# container env at runtime (no build-time baking needed). Fine for local/self-host.
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
