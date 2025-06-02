import requests
import pandas as pd
from pathlib import Path

def download_mcas_data(output_file="mcas_data.csv"):
    """
    Download MCAS Achievement Results data from Mass.gov Education-to-Career portal
    and save it as a CSV file.
    
    Args:
        output_file (str): Path where the CSV file should be saved
    """
    url = "https://educationtocareer.data.mass.gov/api/views/i9w6-niyt/rows.csv"
    
    print("Downloading MCAS data...")
    response = requests.get(url, stream=True)
    response.raise_for_status()  # Raise an exception for bad status codes
    
    # Save the raw CSV file
    with open(output_file, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    # Load and display basic info about the downloaded data
    df = pd.read_csv(output_file)
    print(f"\nDownload complete! File saved to {output_file}")
    print(f"Number of rows: {len(df)}")
    print(f"Number of columns: {len(df.columns)}")

if __name__ == "__main__":
    # Create output directory if it doesn't exist
    output_dir = Path("data")
    output_dir.mkdir(exist_ok=True)
    
    # Download the data
    download_mcas_data(output_dir / "mcas_data.csv") 