class SuggestList {
	constructor(options) {
        this.suggestions = [];
        this.id = options.id;
    }
    
    addSuggestion(username, content) {
        this.suggestions.push({
            username,
            content
        });
    }

    getId() {
        return this.id;
    }

    getSuggestion(index) {
        return this.suggestions[index];
    }

    getSuggestions() {
        return this.suggestions;
    }
}

module.exports = SuggestList;