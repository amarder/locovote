library(tidyverse)
library(readxl)
library(networkD3)

# DOR = Department of Revenue

demographics <- read_excel("CommunityComparisonGeneral.xlsx")
spending <- read_excel("GenFundExpenditures2023.xlsx")
# probably makes sense to include Enterprise and CPA Funds
revenue <- read_excel("CC_Revenue_by_Source.xlsx", skip = 1)
levies <- read_excel("CC_Levies_and_Tax_by_Class.xlsx")

municipalities <- demographics

for (data in list(spending, revenue, levies)) {
    drop <- sapply(names(data), function(x) (x != "DOR Code") & (x %in% names(demographics)))
    print(names(drop)[drop])
    municipalities <- left_join(municipalities, data[, !drop], by = "DOR Code")
}   

# it would be nice to have number of students


write_csv(municipalities, "municipalities.csv")