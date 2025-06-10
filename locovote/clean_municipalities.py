#!/usr/bin/env python3
"""
Script to examine and clean municipality data from processed arrow files.
This script reads all arrow files in ../data/processed and provides information about their contents.
"""

import pandas as pd
import os
import glob
from pathlib import Path
import pyarrow.feather as feather

def examine_arrow_file(file_path):
    """Examine a single arrow file and print information about its contents"""
    try:
        print(f"\n{'='*80}")
        print(f"FILE: {os.path.basename(file_path)}")
        print(f"PATH: {file_path}")
        print(f"{'='*80}")
        
        # Read the arrow file
        df = pd.read_feather(file_path)
        
        # Basic information
        print(f"SHAPE: {df.shape[0]:,} rows × {df.shape[1]} columns")
        print(f"MEMORY USAGE: {df.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
        
        # Column information
        print(f"\nCOLUMNS ({len(df.columns)}):")
        for i, col in enumerate(df.columns, 1):
            non_null_count = df[col].count()
            null_count = len(df) - non_null_count
            dtype = str(df[col].dtype)
            print(f"  {i:2d}. {col:30s} | {dtype:15s} | {non_null_count:,} non-null, {null_count:,} null")
        
        # Data types summary
        print(f"\nDATA TYPES SUMMARY:")
        dtype_counts = df.dtypes.value_counts()
        for dtype, count in dtype_counts.items():
            print(f"  {dtype}: {count} columns")
        
        # Check for key identifier columns
        key_columns = ['Municipality', 'Fiscal Year', 'DOR Code', 'Year']
        found_keys = [col for col in key_columns if col in df.columns]
        if found_keys:
            print(f"\nKEY IDENTIFIER COLUMNS FOUND: {found_keys}")
            for col in found_keys:
                unique_count = df[col].nunique()
                print(f"  {col}: {unique_count:,} unique values")
                if unique_count <= 10:
                    values = sorted(df[col].unique())
                    print(f"    Values: {values}")
        
        # Sample data
        print(f"\nSAMPLE DATA (first 5 rows):")
        # Show only first few columns if there are many
        display_cols = list(df.columns[:10]) if len(df.columns) > 10 else list(df.columns)
        sample_df = df[display_cols].head()
        print(sample_df.to_string(index=True))
        
        if len(df.columns) > 10:
            print(f"\n... and {len(df.columns) - 10} more columns")
        
        # Missing data summary
        missing_data = df.isnull().sum()
        missing_data = missing_data[missing_data > 0].sort_values(ascending=False)
        if len(missing_data) > 0:
            print(f"\nMISSING DATA:")
            for col, missing_count in missing_data.head(10).items():
                pct_missing = (missing_count / len(df)) * 100
                print(f"  {col:30s}: {missing_count:,} ({pct_missing:.1f}%)")
            if len(missing_data) > 10:
                print(f"  ... and {len(missing_data) - 10} more columns with missing data")
        else:
            print(f"\n✓ NO MISSING DATA")
        
        # Summary statistics for numeric columns
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) > 0:
            print(f"\nNUMERIC COLUMNS SUMMARY ({len(numeric_cols)} columns):")
            # Show summary for first few numeric columns
            display_numeric = list(numeric_cols[:5])
            summary = df[display_numeric].describe()
            print(summary.to_string())
            if len(numeric_cols) > 5:
                print(f"\n... and {len(numeric_cols) - 5} more numeric columns")
        
        return df
        
    except Exception as e:
        print(f"ERROR reading {file_path}: {e}")
        return None

def main():
    """Main function to examine all arrow files in ../data/processed"""
    
    # Define the data directory
    data_dir = Path('../data/processed')
    
    if not data_dir.exists():
        print(f"ERROR: Data directory {data_dir} does not exist")
        return
    
    # Find all arrow files
    arrow_files = sorted(glob.glob(str(data_dir / '*.arrow'))) + sorted(glob.glob(str(data_dir / '*.feather')))
    
    if not arrow_files:
        print(f"No arrow/feather files found in {data_dir}")
        return
    
    print(f"Found {len(arrow_files)} arrow/feather files in {data_dir}")
    
    # Store dataframes for potential analysis
    dataframes = {}
    
    # Examine each file
    for file_path in arrow_files:
        df = examine_arrow_file(file_path)
        if df is not None:
            filename = os.path.basename(file_path)
            dataframes[filename] = df
    
    # Summary across all files
    if dataframes:
        print(f"\n{'='*80}")
        print(f"SUMMARY ACROSS ALL FILES")
        print(f"{'='*80}")
        
        total_rows = sum(len(df) for df in dataframes.values())
        total_cols = sum(len(df.columns) for df in dataframes.values())
        
        print(f"Total files processed: {len(dataframes)}")
        print(f"Total rows across all files: {total_rows:,}")
        print(f"Total columns across all files: {total_cols:,}")
        
        # Check for common columns across files
        if len(dataframes) > 1:
            all_columns = set()
            for df in dataframes.values():
                all_columns.update(df.columns)
            
            common_columns = set(list(dataframes.values())[0].columns)
            for df in list(dataframes.values())[1:]:
                common_columns &= set(df.columns)
            
            print(f"\nCommon columns across all files ({len(common_columns)}):")
            for col in sorted(common_columns):
                print(f"  - {col}")
            
            unique_to_files = all_columns - common_columns
            if unique_to_files:
                print(f"\nColumns unique to specific files ({len(unique_to_files)}):")
                for col in sorted(unique_to_files):
                    files_with_col = [name for name, df in dataframes.items() if col in df.columns]
                    print(f"  - {col}: {files_with_col}")

if __name__ == "__main__":
    main() 