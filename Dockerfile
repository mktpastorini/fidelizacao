# Estágio de Build
FROM node:18-alpine AS builder

# Instalar dependências de compilação para pacotes nativos (como canvas)
RUN apk add --no-cache python3 make g++ build-base

WORKDIR /app

# Copiar arquivos de pacote e instalar dependências
COPY package.json ./
RUN npm install

# Copiar o restante do código-fonte da aplicação
COPY . .

# Construir a aplicação
RUN npm run build

# Estágio de Produção
FROM nginx:alpine

# Copiar a configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar os arquivos de build do estágio anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Expor a porta 80
EXPOSE 80

# Comando para iniciar o Nginx
CMD ["nginx", "-g", "daemon off;"]