FROM node:18-alpine

WORKDIR /app

# Kopiere package.json und package-lock.json (falls vorhanden)
COPY package*.json ./

# Installiere Abhängigkeiten
RUN npm install

# Erstelle Datenverzeichnis
RUN mkdir -p /app/data

# Kopiere den Rest des Codes
COPY . .

# Starte die Anwendung
CMD ["node", "index.js"] 