package com.stylefit.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

    @GetMapping(value = {"/upload", "/result"})
    public String forward() {
        return "forward:/index.html";
    }
}
