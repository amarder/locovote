from invoke import task

@task
def download_data(c):
    print("Downloading data...")
    # Your data downloading logic will go here
    # For example: c.run("wget ...") or use python libraries like requests

@task
def clean_data(c):
    print("Cleaning data...")
    # Your data cleaning logic will go here
    # For example: c.run("python locovote/cleaner.py")

@task(pre=[download_data, clean_data])
def process_data(c):
    print("Data processing complete.") 