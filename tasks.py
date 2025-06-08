from invoke import task
from pathlib import Path
import os
import shutil
import platform
from locovote.mcas import download_mcas_data
from locovote.mass_gov_div_local_services import download_tables as download_financial_data
from locovote.general_fund import download_general_fund_data
from locovote.download_dor_data import download_population_data, download_tax_levies_data
from locovote.mcas_parquet import clean_mcas
from locovote.finances import clean_dor_data
from locovote.clean_general_fund import main as clean_general_fund
from locovote.clean_population import clean_population_data

DATA_DIR = Path("./data")
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

# Define subdirectories for different data sources
DOR_GENERAL_FUND_DIR = RAW_DIR / "dor-general-fund"
DOR_COMMUNITY_COMPARISON_DIR = RAW_DIR / "dor-community-comparison"

def get_download_dir():
    """Get appropriate download directory based on environment."""
    if platform.system() == 'Darwin':
        # On macOS, use Downloads directory to avoid permissions issues
        return Path.home() / "Downloads"
    else:
        # For other environments, use the raw directory
        return RAW_DIR

def handle_macos_download(download_func, target_dir):
    """Handle downloads on macOS by downloading to Downloads dir and moving files.
    
    Args:
        download_func: Function that performs the download and returns list of downloaded files
        target_dir: Directory where files should end up
    """
    target_dir.mkdir(parents=True, exist_ok=True)
    
    if platform.system() == 'Darwin':
        download_dir = get_download_dir()
        downloaded_files = download_func(download_dir)
        
        # Move downloaded files to target directory
        for file in downloaded_files:
            shutil.move(str(file), str(target_dir / file.name))
    else:
        download_func(target_dir)

@task
def download_mcas(c):
    """Download MCAS (Massachusetts Comprehensive Assessment System) data."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    download_mcas_data(RAW_DIR)

@task
def download_dor_community_comparisons(c):
    """Download Massachusetts Department of Revenue (DOR) Community Comparison Reports."""
    if DOR_COMMUNITY_COMPARISON_DIR.exists():
        print(f"Directory {DOR_COMMUNITY_COMPARISON_DIR} already exists. Skipping download.")
        return
    
    handle_macos_download(
        download_func=download_financial_data,
        target_dir=DOR_COMMUNITY_COMPARISON_DIR
    )

@task
def download_dor_general_fund(c):
    """Download Massachusetts Department of Revenue (DOR) General Fund data."""
    if DOR_GENERAL_FUND_DIR.exists():
        print(f"Directory {DOR_GENERAL_FUND_DIR} already exists. Skipping download.")
        return
    
    handle_macos_download(
        download_func=download_general_fund_data,
        target_dir=DOR_GENERAL_FUND_DIR
    )

@task(download_mcas)
def clean_mcas_data(c):
    """Clean and process MCAS achievement data."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    input_path = RAW_DIR / "MCAS_Achievement_Results.csv"
    output_path = PROCESSED_DIR / "mcas.db"
    if output_path.exists():
        print(f"File {output_path} already exits. Skipping cleaning.")
    else:
        clean_mcas(input_path=str(input_path), output_path=str(output_path))

@task(download_dor_community_comparisons, download_dor_general_fund)
def clean_finance_data(c):
    """Clean and process Massachusetts municipal financial data."""
    paths = {
        "demographics": DOR_COMMUNITY_COMPARISON_DIR / "CommunityComparisonGeneral.xlsx",
        "revenue": DOR_COMMUNITY_COMPARISON_DIR / "CC_Revenue_by_Source.xlsx",
        "levies": DOR_COMMUNITY_COMPARISON_DIR / "CC_Levies_and_Tax_by_Class.xlsx",
        "spending": DOR_GENERAL_FUND_DIR / "GenFundExpenditures2023.xlsx",
        "municipalities": PROCESSED_DIR / "municipalities.csv",
    }
    for k, v in paths.items():
        paths[k] = str(v)
    clean_dor_data(paths)

@task(download_dor_general_fund)
def clean_dor_general_fund(c):
    """Clean and process Massachusetts DOR General Fund data."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PROCESSED_DIR / "combined_general_fund.arrow"
    if output_path.exists():
        print(f"File {output_path} already exists. Skipping cleaning.")
    else:
        clean_general_fund()

@task
def download_population(c):
    """Download Massachusetts population data from DOR."""
    print("Downloading population data...")
    target = RAW_DIR / "population.xlsx"
    if target.exists():
        print(f"Population data already downloaded: {target}")
        return
    downloaded_file = download_population_data(download_dir=RAW_DIR)
    
    if downloaded_file:
        print(f"Population data downloaded successfully to: {downloaded_file}")
    else:
        print("Failed to download population data")

@task(download_population)
def clean_population_data_task(c):
    """Clean and process Massachusetts population data."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PROCESSED_DIR / "population.arrow"
    if output_path.exists():
        print(f"File {output_path} already exists. Skipping cleaning.")
    else:
        input_path = RAW_DIR / "population.xlsx"
        clean_population_data(input_path=input_path, output_path=output_path)

@task
def download_tax_levies(c):
    """Download Massachusetts tax levies by class data from DOR."""
    print("Downloading tax levies data...")
    target = RAW_DIR / "tax_levies_data.xlsx"
    if target.exists():
        print(f"Tax levies data already downloaded: {target}")
        return
    downloaded_file = download_tax_levies_data(download_dir=RAW_DIR)
    
    if downloaded_file:
        print(f"Tax levies data downloaded successfully to: {downloaded_file}")
    else:
        print("Failed to download tax levies data")

@task(clean_mcas_data, clean_finance_data, clean_dor_general_fund, clean_population_data_task)
def clean_data(c):
    """Run all data cleaning tasks in the correct order."""
    pass
