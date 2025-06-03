from invoke import task
from pathlib import Path
import os
import shutil
import platform
from locovote.mcas import download_mcas_data
from locovote.mass_gov_div_local_services import download_tables as download_financial_data

DATA_DIR = Path("./data")
RAW_DIR = DATA_DIR / "raw"

def get_download_dir():
    """Get appropriate download directory based on environment."""
    if platform.system() == 'Darwin':
        # On macOS, use Downloads directory to avoid permissions issues
        return Path.home() / "Downloads"
    else:
        # For other environments, use the raw directory
        return RAW_DIR

@task
def download_mcas(c):
    """Download MCAS data to the data/raw directory."""
    output_file = RAW_DIR / "mcas_data.csv"
    
    if output_file.exists():
        print(f"File already exists at {output_file}. Skipping download.")
        return
        
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    download_mcas_data(output_file) 
    
@task
def download_mass_dor(c):
    """Download Mass DOR Community Comparison Report data."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    download_financial_data(RAW_DIR)

@task(download_mcas, download_mass_dor)
def download_all(c):
    print("Downloading data...")
    # Your data downloading logic will go here
    # For example: c.run("wget ...") or use python libraries like requests

@task
def clean_data(c):
    print("Cleaning data...")
    # Your data cleaning logic will go here
    # For example: c.run("python locovote/cleaner.py")

# @task(pre=[download_data, clean_data])
# def process_data(c):
#     print("Data processing complete.")
