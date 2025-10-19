# Estágio de Build
FROM node:18-alpine AS builder

# Instalar dependências de compilação para pacotes nativos (canvas, tfjs-node)
# Inclui Python, make, g++, build-base (para node-gyp)
# E as libs necessárias para canvas (cairo, pango, jpeg, gif, etc.)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    build-base \
    pkgconfig \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    libtool \
    autoconf \
    automake \
    libpng-dev \
    zlib-dev \
    libxml2-dev \
    libjpeg-turbo-dev \
    libwebp-dev \
    freetype-dev \
    fontconfig-dev \
    harfbuzz-dev \
    pixman-dev

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