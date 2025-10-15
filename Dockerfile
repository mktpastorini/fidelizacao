# Estágio 1: Construir a aplicação React
FROM node:18-alpine AS builder
WORKDIR /app

# Copiar arquivos de pacote e instalar dependências
COPY package.json ./
RUN npm install

# Copiar o restante do código-fonte da aplicação
COPY . .

# Construir a aplicação para produção
RUN npm run build

# Estágio 2: Servir a aplicação com Nginx
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Remover os arquivos padrão do Nginx
RUN rm -rf ./*

# Copiar os arquivos construídos do estágio anterior
COPY --from=builder /app/dist .

# Copiar a configuração personalizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor a porta 80
EXPOSE 80

# Iniciar o Nginx
CMD ["nginx", "-g", "daemon off;"]