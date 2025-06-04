import requests
import pandas as pd
from pathlib import Path

def download_mcas_data(output_dir=".", output_filename="MCAS_Achievement_Results.csv"):
    """
    Download MCAS Achievement Results data from Mass.gov Education-to-Career portal
    and save it as a CSV file.
    
    Args:
        output_dir (str): Directory where the CSV file should be saved (default: current directory)
        output_filename (str): Name of the output CSV file (default: MCAS_Achievement_Results.csv)
    """
    url = "https://educationtocareer.data.mass.gov/api/views/i9w6-niyt/rows.csv"
    
    # Convert to Path objects and create full output path
    output_dir = Path(output_dir)
    output_path = output_dir / output_filename
    
    # Check if file already exists
    if output_path.exists():
        print(f"File {output_path} already exists. Skipping download.")
        return
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("Downloading MCAS data...")
    response = requests.get(url, stream=True)
    response.raise_for_status()  # Raise an exception for bad status codes
    
    # Save the raw CSV file
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    # Load and display basic info about the downloaded data
    df = pd.read_csv(output_path)
    print(f"\nDownload complete! File saved to {output_path}")
    print(f"Number of rows: {len(df)}")
    print(f"Number of columns: {len(df.columns)}")

if __name__ == "__main__":
    download_mcas_data() 