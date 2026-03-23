FROM node:20-slim

RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# AWS CLI インストール
RUN curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip \
    && unzip -q awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws/

WORKDIR /repo

COPY deploy.sh /deploy.sh
RUN chmod +x /deploy.sh

CMD ["/deploy.sh"]
