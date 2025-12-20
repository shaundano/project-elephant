FROM public.ecr.aws/lambda/python:3.14

# Install system tools (unzip is critical for your new flow)
RUN dnf install -y wget tar xz unzip

# Install Static FFmpeg
RUN wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
    && tar -xf ffmpeg-release-amd64-static.tar.xz \
    && mv ffmpeg-*-amd64-static/ffmpeg /usr/bin/ffmpeg \
    && mv ffmpeg-*-amd64-static/ffprobe /usr/bin/ffprobe \
    && chmod +x /usr/bin/ffmpeg /usr/bin/ffprobe \
    && rm -rf ffmpeg-*

# Python Deps
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Lambda Code
COPY lambda_function.py ${LAMBDA_TASK_ROOT}

CMD [ "lambda_function.lambda_handler" ]


