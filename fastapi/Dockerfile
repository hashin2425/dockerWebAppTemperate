FROM python:3.9

WORKDIR /code

COPY ./fastapi/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY ./fastapi /code/app

CMD ["uvicorn", "app.main:fastapi", "--host", "0.0.0.0", "--port", "80"]
