library(tidyverse)

path <- "~/Documents/data/Next_Generation_MCAS_Achievement_Results_20240913.csv"
combined <- readr::read_csv(path) %>%
    filter(STUGRP == "All Students")

# make sure these are unique identifiers
combined %>%
    select(ORG_CODE, SUBJECT_CODE, TEST_GRADE, SY) %>%
    unique() %>%
    nrow()
combined %>% nrow()

# drop these rows
combined <- combined %>%
    filter(!(TEST_GRADE %in% c("ALL (03-08)", "HS SCI")))

output <- combined %>%
    select(SUBJECT_CODE, M_PLUS_E_CNT, E_CNT, STU_CNT, DIST_NAME, ORG_NAME, TEST_GRADE, SY, ORG_CODE) %>%
    mutate(
        year = as.integer(SY),
        grade = as.integer(TEST_GRADE),
        `n_me` = as.integer(M_PLUS_E_CNT),
        `n_e` = as.integer(E_CNT),
        `n` = as.integer(STU_CNT)
    ) %>%
    select(-M_PLUS_E_CNT, -E_CNT, -STU_CNT, -TEST_GRADE, -SY)

arrow::write_parquet(output, "mcas.parquet")