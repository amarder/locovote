library(tidyverse)
library(pander)

towns <- c("Wayland", "Sudbury", "Lincoln-Sudbury", "Lincoln")

l <- system('ls *.xlsx', intern = TRUE)
tables <- lapply(l, function(path) {
    data <- readxl::read_xlsx(path, skip = 1)
    data$path <- path
    return(data)
})

combined <- bind_rows(tables) %>%
    separate(path, c("year", "grade", "extension")) %>%
    mutate(year = as.numeric(year), grade = as.numeric(grade)) %>%
    separate(`School Name`, c("district", "school"), sep = " - ")

props <- combined %>%
    group_by(school, district, grade, Subject) %>%
    summarise(
        me = sum(as.integer(`M+E #`)),
        e = sum(as.integer(`E #`)),
        n = sum(as.integer(`No. of Students Included`))
    ) %>%
    ungroup() %>%
    mutate(
        p_e = e / n,
        p_me = me / n
    )

g <- props %>%
    filter(district %in% towns) %>%
    filter(Subject != "SCI") %>%
    select(school, district, Subject, grade, p_e, p_me) %>%
    gather(variable, value, 5:6) %>%
    mutate(variable = recode(variable, "p_e"="Exceeding Expectations", "p_me"="Meeting or Exceeding Expectations")) %>%
    arrange(district, grade) %>%
    ggplot(aes(x = grade, y = value, color = school)) +
    geom_point() +
    geom_line() +
    theme_bw() +
    facet_grid(Subject + variable ~ district) +
    xlab("Grade") +
    ggtitle("MCAS Results") +
    ylab("Exceeding Expectations") +
    scale_y_continuous(labels = scales::percent, limits = c(0, 1))

ggsave("wayland.pdf", g, width = 10, height = 10)

combined %>%
    mutate(high_school=grade > 8) %>%
    group_by(high_school, district, Subject) %>%
    summarise(
        me = sum(as.integer(`M+E #`)),
        e = sum(as.integer(`E #`)),
        n = sum(as.integer(`No. of Students Included`))
    ) %>%
    ungroup() %>%
    mutate(
        p_e = e / n,
        p_me = me / n
    ) %>%
    filter(district %in% towns) %>%
    filter(Subject != "SCI") %>%
    arrange(desc(p_e)) %>%
    mutate(p_e = round(100 * p_e), p_me = round(100 * p_me)) %>%
    select(Town=district, Subject, `# Tests`=n, `% Exceeding`=p_e, `% Meeting or Exceeding`=p_me, high_school) %>%
    pandoc.table(split.tables = Inf)