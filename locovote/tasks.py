from invoke import task
from pathlib import Path
from locovote.mcas import download_mcas_data

@task
def download_mcas(c):
    """Download MCAS data to the data/raw directory."""
    output_dir = Path("../data/raw")
    output_file = output_dir / "mcas_data.csv"
    
    if output_file.exists():
        print(f"File already exists at {output_file}. Skipping download.")
        return
        
    output_dir.mkdir(parents=True, exist_ok=True)
    download_mcas_data(output_file) 
    
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
