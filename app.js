(function () {
  var analyticsKey = "courselistschemaqa_analytics_events";
  var intentKey = "courselistschemaqa_purchase_intents";
  var state = {
    latestBriefText: "",
    latestRequestText: "",
    pricingTracked: false
  };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (error) {
      return [];
    }
  }

  function storeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function acquisition() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source") || "direct",
      utm_medium: params.get("utm_medium") || "none",
      utm_campaign: params.get("utm_campaign") || "none"
    };
  }

  function track(eventName, detail) {
    var events = readJson(analyticsKey);
    events.push(Object.assign({
      event: eventName,
      at: new Date().toISOString(),
      path: window.location.pathname
    }, acquisition(), detail || {}));
    storeJson(analyticsKey, events.slice(-100));
  }

  function pulseClass(element, className, delay) {
    if (!element) return;
    element.classList.add(className);
    window.setTimeout(function () {
      element.classList.remove(className);
    }, delay || 480);
  }

  function copyText(text) {
    function fallbackCopy() {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return Promise.resolve();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(fallbackCopy);
    }
    return fallbackCopy();
  }

  function sampleJson() {
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "item": {
            "@type": "Course",
            "url": "https://example.edu/courses/data-analytics-old-cohort",
            "name": "Best AI Bootcamp - only $99 this week",
            "description": "AI.",
            "provider": {
              "@type": "Organization",
              "name": "Example Academy"
            }
          }
        },
        {
          "@type": "ListItem",
          "item": {
            "@type": "Course",
            "url": "https://example.edu/courses/data-analytics-old-cohort",
            "name": "Free webinar: make money fast",
            "description": "",
            "provider": {
              "@type": "Organization"
            }
          }
        }
      ]
    }, null, 2);
  }

  function loadSample() {
    qs("#jsonld-input").value = sampleJson();
    qs("#visible-notes").value = "Visible catalog shows 4 courses: Data Analytics, AI Product Management, SQL for Marketers, and UX Research. The page is the canonical course catalog summary.";
    qs("#count-notes").value = "Only two Course items are present in JSON-LD. Two visible catalog cards are missing from the list markup.";
    qs("#provider-notes").value = "Provider should be Example Academy Continuing Education on every course. One JSON-LD provider is blank and LMS owner is TBD.";
    qs("#title-notes").value = "Visible titles should not include discounts or free-webinar language. Descriptions need clear learning outcomes, not promotional snippets.";
    qs("#url-notes").value = "Visible catalog uses /courses/data-analytics-2026 and /courses/ai-product-management-2026. JSON-LD still points to old cohort URLs and duplicates one URL.";
    qs("#owner-notes").value = "Owner TBD across LMS, course marketing, catalog, frontend, content, and SEO cleanup.";
    qs("#page-type").value = "Course catalog summary page";
    track("sample_course_catalog_data_loaded", { triggerSource: "sample_button" });
  }

  function parseJsonInput(input) {
    var trimmed = input.trim();
    if (!trimmed) throw new Error("Paste Course or ItemList JSON-LD before generating a brief.");
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error("JSON-LD could not be parsed. Paste one valid JSON object or array.");
    }
  }

  function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function typeList(node) {
    return toArray(node && node["@type"]).map(function (type) {
      return clean(type);
    });
  }

  function hasType(node, expected) {
    return typeList(node).some(function (type) {
      return lower(type).indexOf(lower(expected)) !== -1;
    });
  }

  function walk(value, callback) {
    if (!value || typeof value !== "object") return;
    callback(value);
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        walk(item, callback);
      });
      return;
    }
    Object.keys(value).forEach(function (key) {
      walk(value[key], callback);
    });
  }

  function collect(data, expectedType) {
    var nodes = [];
    walk(data, function (node) {
      if (!Array.isArray(node) && hasType(node, expectedType)) nodes.push(node);
    });
    return nodes;
  }

  function valueText(value) {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map(valueText).join(" ");
    if (typeof value === "object") {
      return Object.keys(value).map(function (key) {
        return key + " " + valueText(value[key]);
      }).join(" ");
    }
    return "";
  }

  function hasValue(value) {
    return clean(valueText(value)).length > 0;
  }

  function includesAny(value, needles) {
    var haystack = lower(Array.isArray(value) ? value.join(" ") : value);
    return needles.some(function (needle) {
      return haystack.indexOf(lower(needle)) !== -1;
    });
  }

  function unique(values) {
    var seen = {};
    return values.filter(function (value) {
      var key = lower(value);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function addFinding(sections, key, text) {
    sections[key].push(text);
  }

  function itemListElements(itemLists) {
    return itemLists.reduce(function (items, list) {
      return items.concat(toArray(list.itemListElement));
    }, []);
  }

  function courseUrl(course, listItem) {
    return clean(course.url || course["@id"] || listItem.url || listItem.item || "");
  }

  function analyzeCourse(input) {
    var data = parseJsonInput(input.jsonld);
    var courses = collect(data, "Course");
    var itemLists = collect(data, "ItemList");
    var listItems = itemListElements(itemLists);
    var notes = [
      input.visibleNotes,
      input.countNotes,
      input.providerNotes,
      input.titleNotes,
      input.urlNotes,
      input.ownerNotes,
      input.pageType
    ].join(" ");
    var sections = {
      fit: [],
      count: [],
      required: [],
      provider: [],
      title: [],
      url: [],
      parity: [],
      owner: [],
      handoff: []
    };

    if (includesAny(notes, ["webinar", "event", "blog", "article", "coupon", "discount"]) && !includesAny(notes, ["course catalog", "course list", "learning outcome", "curriculum"])) {
      addFinding(sections, "fit", "non-course content or course-definition fit risk: visible notes mention content that may not be a course catalog with curriculum, lessons, and student roster context.");
    }
    courses.forEach(function (course) {
      var title = valueText(course.name);
      if (includesAny(title, ["free", "only", "$", "discount", "best", "make money fast", "% off"])) {
        addFinding(sections, "fit", "non-course content or course-definition fit risk: Course name appears promotional instead of a neutral course title.");
      }
    });

    if (courses.length < 3 || includesAny(input.countNotes, ["only two", "fewer than three", "missing from the list"])) {
      addFinding(sections, "count", "fewer-than-three course list risk: Course list markup should be reviewed because fewer than three Course items are present or represented.");
    }
    if (!itemLists.length) {
      addFinding(sections, "count", "fewer-than-three course list risk: no ItemList was found for the course catalog summary/list page.");
    }

    if (!courses.length) {
      addFinding(sections, "required", "missing Course, ItemList, or required list field: no Course item was found in the pasted JSON-LD.");
    }
    courses.forEach(function (course, index) {
      ["name", "description"].forEach(function (field) {
        if (!hasValue(course[field])) {
          addFinding(sections, "required", "missing Course, ItemList, or required list field: Course " + (index + 1) + " is missing " + field + ".");
        }
      });
    });
    if (!itemLists.length || !listItems.length) {
      addFinding(sections, "required", "missing Course, ItemList, or required list field: ItemList itemListElement is missing.");
    }
    listItems.forEach(function (item, index) {
      if (!hasValue(item.position)) {
        addFinding(sections, "required", "missing Course, ItemList, or required list field: ListItem " + (index + 1) + " is missing position.");
      }
      var nestedCourse = item.item && typeof item.item === "object" ? item.item : {};
      if (!hasValue(nestedCourse.url || item.url)) {
        addFinding(sections, "required", "missing Course, ItemList, or required list field: ListItem " + (index + 1) + " is missing a unique URL.");
      }
    });

    courses.forEach(function (course, index) {
      if (!hasValue(course.provider) || !hasValue(course.provider && course.provider.name)) {
        addFinding(sections, "provider", "provider gap or provider mismatch: Course " + (index + 1) + " is missing provider.name.");
      }
    });
    if (includesAny(input.providerNotes, ["should be", "blank", "mismatch", "tbd"])) {
      addFinding(sections, "provider", "provider gap or provider mismatch: provider notes indicate visible/LMS provider ownership does not match the pasted Course markup.");
    }

    courses.forEach(function (course, index) {
      var title = valueText(course.name);
      var description = valueText(course.description);
      if (includesAny(title, ["free", "only", "$", "discount", "% off", "best", "make money fast"])) {
        addFinding(sections, "title", "promotional title, price-title, or thin description risk: Course " + (index + 1) + " title contains promotional or price language.");
      }
      if (description.length < 24) {
        addFinding(sections, "title", "promotional title, price-title, or thin description risk: Course " + (index + 1) + " description is thin or missing a clear learning outcome.");
      }
    });
    if (includesAny(input.titleNotes, ["discount", "free-webinar", "promotional", "learning outcomes"])) {
      addFinding(sections, "title", "promotional title, price-title, or thin description risk: visible title/description notes require cleanup before launch.");
    }

    var urls = listItems.map(function (item) {
      var nestedCourse = item.item && typeof item.item === "object" ? item.item : {};
      return courseUrl(nestedCourse, item);
    }).filter(Boolean);
    if (urls.length !== unique(urls).length) {
      addFinding(sections, "url", "duplicate, missing, or stale course URL risk: two or more ListItem/Course URLs are duplicated.");
    }
    courses.forEach(function (course, index) {
      if (!hasValue(course.url)) {
        addFinding(sections, "url", "duplicate, missing, or stale course URL risk: Course " + (index + 1) + " is missing url.");
      }
    });
    if (includesAny(input.urlNotes, ["old cohort", "stale", "duplicate", "canonical", "2026"]) && !includesAny(urls.join(" "), ["2026"])) {
      addFinding(sections, "url", "duplicate, missing, or stale course URL risk: visible URL/canonical notes mention newer course URLs but JSON-LD appears stale.");
    }

    if (includesAny(input.visibleNotes + " " + input.countNotes, ["4 courses", "four courses", "missing from the list"]) && courses.length < 4) {
      addFinding(sections, "parity", "visible catalog/schema mismatch: visible catalog notes show more course cards than the pasted Course JSON-LD.");
    }
    if (includesAny(input.visibleNotes + " " + input.titleNotes + " " + input.providerNotes + " " + input.urlNotes, ["should", "visible", "missing", "old", "blank", "mismatch"])) {
      addFinding(sections, "parity", "visible catalog/schema mismatch: visible catalog, provider, title, or URL notes disagree with pasted Course list markup.");
    }

    if (!clean(input.ownerNotes) || includesAny(input.ownerNotes, ["TBD", "unknown", "not assigned"])) {
      addFinding(sections, "owner", "missing owner remediation decision across LMS, course marketing, catalog, frontend, content, or SEO owners.");
    }

    addFinding(sections, "handoff", "Confirm visible catalog cards, Course JSON-LD, ItemList positions, provider names, course URLs, canonical targets, and owner decisions before publishing.");
    addFinding(sections, "handoff", "Do not treat this QA brief as education compliance, accreditation, rich-result eligibility, ranking, indexing, enrollment operations, or student-support advice.");

    return {
      courseCount: courses.length,
      itemListCount: itemLists.length,
      listItemCount: listItems.length,
      sections: sections
    };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char];
    });
  }

  function sectionHtml(title, items) {
    if (!items.length) {
      return [
        "<section class=\"brief-section\">",
        "<h4>", escapeHtml(title), "</h4>",
        "<p>No issue flagged from the pasted sample. Confirm manually before launch.</p>",
        "</section>"
      ].join("");
    }
    return [
      "<section class=\"brief-section\">",
      "<h4>", escapeHtml(title), "</h4>",
      "<ul>",
      items.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join(""),
      "</ul>",
      "</section>"
    ].join("");
  }

  function briefText(result, input) {
    function lines(title, items) {
      return [title].concat(items.length ? items.map(function (item) { return "- " + item; }) : ["- No issue flagged from the pasted sample."]).join("\n");
    }
    return [
      "Course list schema QA brief",
      "",
      "Page type: " + input.pageType,
      "Course items found: " + result.courseCount,
      "ItemList items found: " + result.itemListCount,
      "ListItem entries found: " + result.listItemCount,
      "",
      lines("Course-definition warnings", result.sections.fit),
      "",
      lines("Course count and list warnings", result.sections.count),
      "",
      lines("Required Course and ItemList warnings", result.sections.required),
      "",
      lines("Provider warnings", result.sections.provider),
      "",
      lines("Title and description warnings", result.sections.title),
      "",
      lines("URL and canonical warnings", result.sections.url),
      "",
      lines("Visible catalog parity warnings", result.sections.parity),
      "",
      lines("Owner remediation reminders", result.sections.owner),
      "",
      lines("Handoff reminders", result.sections.handoff)
    ].join("\n");
  }

  function renderBrief(result, input) {
    var output = qs("#brief-output");
    var title = qs("#output-title");
    var status = qs("#status-pill");
    var copy = qs("#copy-brief");
    var findingCount = Object.keys(result.sections).reduce(function (count, key) {
      return count + result.sections[key].length;
    }, 0);
    var tone = findingCount > 7 ? "danger" : findingCount > 3 ? "warning" : "good";
    output.className = "brief-output has-brief is-updated";
    qs(".output-panel").className = "output-panel reveal is-visible has-brief status-" + tone;
    status.className = "confidence-pill status-" + tone;
    output.innerHTML = [
      sectionHtml("Parse summary", [
        result.courseCount + " Course item(s) found.",
        result.itemListCount + " ItemList item(s) found.",
        result.listItemCount + " ListItem entrie(s) found.",
        "Selected page type: " + input.pageType
      ]),
      sectionHtml("Course-definition warnings", result.sections.fit),
      sectionHtml("Course count and list warnings", result.sections.count),
      sectionHtml("Required Course and ItemList warnings", result.sections.required),
      sectionHtml("Provider warnings", result.sections.provider),
      sectionHtml("Title and description warnings", result.sections.title),
      sectionHtml("URL and canonical warnings", result.sections.url),
      sectionHtml("Visible catalog parity warnings", result.sections.parity),
      sectionHtml("Owner remediation reminders", result.sections.owner),
      sectionHtml("Handoff reminders", result.sections.handoff)
    ].join("");
    title.textContent = "Course list schema QA brief ready";
    status.textContent = "Ready";
    copy.disabled = false;
    state.latestBriefText = briefText(result, input);
    track("core_action_completed", {
      courseCount: result.courseCount,
      itemListCount: result.itemListCount,
      findingCount: findingCount
    });
    window.setTimeout(function () { output.classList.remove("is-updated"); }, 450);
  }

  function setupAuditor() {
    var form = qs("#auditor-form");
    var error = qs("#workflow-error");
    qs("#load-sample").addEventListener("click", loadSample);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      error.textContent = "";
      track("core_action_started", { triggerSource: "generate_button" });
      try {
        var input = {
          jsonld: qs("#jsonld-input").value,
          visibleNotes: qs("#visible-notes").value,
          countNotes: qs("#count-notes").value,
          providerNotes: qs("#provider-notes").value,
          titleNotes: qs("#title-notes").value,
          urlNotes: qs("#url-notes").value,
          ownerNotes: qs("#owner-notes").value,
          pageType: qs("#page-type").value
        };
        renderBrief(analyzeCourse(input), input);
        pulseClass(qs("#generate-brief"), "is-confirmed", 500);
      } catch (err) {
        error.textContent = err.message;
        track("core_action_failed", { reason: err.message });
      }
    });
    qs("#copy-brief").addEventListener("click", function () {
      if (!state.latestBriefText) return;
      copyText(state.latestBriefText).then(function () {
        track("brief_copied", { triggerSource: "copy_button" });
        qs("#copy-brief").textContent = "Copied";
        window.setTimeout(function () { qs("#copy-brief").textContent = "Copy brief"; }, 1100);
      });
    });
  }

  function buildPublicRequest(payload) {
    return [
      "## Role",
      payload.role,
      "",
      "## Course catalog type",
      payload.catalogType,
      "",
      "## Launch cadence",
      payload.launchCadence,
      "",
      "## Plan interest",
      payload.plan,
      "",
      "## Budget range",
      payload.budget,
      "",
      "## Biggest Course schema QA pain",
      payload.pain,
      "",
      "## Purchase intent",
      payload.purchaseIntent ? "- [x] This is a real purchase-intent or pilot request if the tool catches course catalog schema launch risks." : "- [ ] Purchase intent not confirmed yet.",
      "",
      "## Public safety note",
      "Do not paste private client snippets, credentials, email addresses, student data, enrollment data, LMS exports, or accreditation documents into this public issue."
    ].join("\n");
  }

  function setupWaitlist() {
    var form = qs("#waitlist-form");
    var status = qs("#waitlist-status");
    var handoff = qs("#handoff-panel");
    var remoteLink = qs("#remote-intent-link");
    var copyRequest = qs("#copy-request");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      track("signup_started", { triggerSource: "waitlist_form" });
      var payload = {
        email: qs("#email").value,
        role: qs("#role").value,
        catalogType: qs("#catalog-type").value,
        launchCadence: qs("#launch-cadence").value,
        plan: qs("#plan").value,
        budget: qs("#budget").value,
        pain: clean(qs("#pain").value),
        purchaseIntent: qs("#purchase-intent").checked,
        at: new Date().toISOString()
      };
      var intents = readJson(intentKey);
      intents.push(payload);
      storeJson(intentKey, intents.slice(-50));
      track("waitlist_submitted", { role: payload.role, plan: payload.plan, purchaseIntent: payload.purchaseIntent });
      track("feedback_submitted", { triggerSource: "waitlist_form" });
      if (payload.purchaseIntent) track("checkout_intent", { plan: payload.plan });
      state.latestRequestText = buildPublicRequest(payload);
      var issueUrl = "https://github.com/ert93333-ops/course-list-schema-qa-briefs/issues/new"
        + "?template=demo_request.md"
        + "&labels=early-access%2Cpurchase-intent%2Cdemo-request"
        + "&title=" + encodeURIComponent("Course List Schema QA Briefs demo request")
        + "&body=" + encodeURIComponent(state.latestRequestText);
      remoteLink.href = issueUrl;
      handoff.hidden = false;
      handoff.classList.add("is-confirmed");
      form.classList.add("is-submitted");
      status.textContent = "You are on the early access list. Open the public-safe GitHub demo request or copy the request details.";
      track("remote_intent_ready", { triggerSource: "waitlist_form" });
    });
    copyRequest.addEventListener("click", function () {
      if (!state.latestRequestText) return;
      copyText(state.latestRequestText).then(function () {
        track("remote_intent_copied", { triggerSource: "copy_request" });
        copyRequest.textContent = "Copied request details";
        window.setTimeout(function () { copyRequest.textContent = "Copy request details"; }, 1200);
      });
    });
  }

  function setupPlanButtons() {
    var planSelect = qs("#plan");
    qsa(".plan-button").forEach(function (button) {
      button.addEventListener("click", function () {
        var plan = button.getAttribute("data-plan") || "";
        if (planSelect && plan) planSelect.value = plan;
        track("pricing_viewed", { triggerSource: "plan_button" });
        state.pricingTracked = true;
        track("checkout_started", { plan: plan });
        pulseClass(button, "is-selected", 900);
        qs("#waitlist").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function setupTracking() {
    track("landing_viewed", { product: "Course List Schema QA Briefs" });
    qsa("[data-track-cta]").forEach(function (element) {
      element.addEventListener("click", function () {
        track("cta_clicked", { cta: element.getAttribute("data-track-cta") || clean(element.textContent) });
      });
    });
    var pricing = qs("#pricing");
    if ("IntersectionObserver" in window && pricing) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !state.pricingTracked) {
            state.pricingTracked = true;
            track("pricing_viewed", { triggerSource: "scroll" });
          }
        });
      }, { threshold: 0.3 });
      observer.observe(pricing);
    }
  }

  function setupChrome() {
    var header = qs("[data-header]");
    function updateHeader() {
      header.classList.toggle("is-scrolled", window.scrollY > 4);
    }
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
  }

  function setupReveal() {
    var elements = qsa(".reveal");
    if (!("IntersectionObserver" in window)) {
      elements.forEach(function (element) { element.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    elements.forEach(function (element, index) {
      element.style.setProperty("--reveal-delay", Math.min(index * 35, 220) + "ms");
      observer.observe(element);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupTracking();
    setupChrome();
    setupReveal();
    setupAuditor();
    setupWaitlist();
    setupPlanButtons();
  });
})();
