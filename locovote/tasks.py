from invoke import task
from pathlib import Path
import os
import shutil
import platform
from locovote.mcas import download_mcas_data
from locovote.mass_gov_div_local_services import MassDORDataExporter

DATA_DIR = Path("../data")
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
    
    # Check if files already exist
    required_files = [
        'CC_GF_Spend_by_Fun.xlsx',
        'CommunityComparisonGeneral.xlsx',
        'CC_Levies_and_Tax_by_Class.xlsx',
        'CC_Revenue_by_Source.xlsx',
    ]
    
    existing_files = [f for f in required_files if (RAW_DIR / f).exists()]
    if existing_files:
        print(f"The following files already exist and will be skipped: {', '.join(existing_files)}")
    
    # Map our required files to the exporter's table keys
    table_mapping = {
        'CC_GF_Spend_by_Fun.xlsx': 'spending',
        'CommunityComparisonGeneral.xlsx': 'general',
        'CC_Levies_and_Tax_by_Class.xlsx': 'levies_rates',
        'CC_Revenue_by_Source.xlsx': 'revenues_by_source'
    }
    
    download_dir = get_download_dir()
    use_headless = True
    
    print(f"Files will be downloaded to {download_dir}")
    if download_dir != RAW_DIR:
        print("Files will then be moved to the project directory")
    
    with MassDORDataExporter(download_dir=str(download_dir), headless=use_headless) as exporter:
        for filename, table_key in table_mapping.items():
            if filename not in existing_files:
                print(f"Downloading {filename}...")
                filepath = exporter.export_table(table_key)
                if filepath:
                    # If using Downloads directory, move file to RAW_DIR
                    if download_dir != RAW_DIR:
                        try:
                            downloaded_file = Path(filepath)
                            if downloaded_file.exists():
                                shutil.move(str(downloaded_file), str(RAW_DIR / filename))
                                print(f"Successfully moved {filename} to {RAW_DIR}")
                            else:
                                print(f"Warning: Downloaded file {filepath} not found")
                        except Exception as e:
                            print(f"Error moving file {filename}: {e}")
                    else:
                        print(f"Successfully downloaded {filename}")
                else:
                    print(f"Failed to download: {filename}")

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
