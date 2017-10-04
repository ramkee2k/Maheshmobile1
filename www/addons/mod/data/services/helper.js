// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

angular.module('mm.addons.mod_data')

/**
 * Helper to gather some common functions for database.
 *
 * @module mm.addons.mod_data
 * @ngdoc service
 * @name $mmaModDataHelper
 */
.factory('$mmaModDataHelper', function($mmaModData, $mmaModDataFieldsDelegate, $q, mmaModDataComponent, $mmFileUploader) {

    var self = {
            searchOther: {
                'fn': 'firstname',
                'ln': 'lastname'
            }
        };

    /**
     * Displays Advanced Search Fields.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#displayAdvancedSearchFields
     * @param {String} template Template HMTL.
     * @param {Array}  fields   Fields that defines every content in the entry.
     * @return {String}         Generated HTML.
     */
    self.displayAdvancedSearchFields = function(template, fields) {
        var replace;

        // Replace the fields found on template.
        angular.forEach(fields, function(field) {
            replace = "[[" + field.name + "]]";
            replace = replace.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            replace = new RegExp(replace);

            // Replace field by a generic directive.
            var render = '<mma-mod-data-field mode="search" field="fields['+ field.id + ']"></mma-mod-data-field>';
            template = template.replace(replace, render);
        });

        // Not pluginable other search elements.
        angular.forEach(self.searchOther, function(field, name) {
            replace = new RegExp("##" + field + "##");

            // Replace field by the text input.
            var render = '<input type="text" name="' + name + '" placeholder="{{ \'mma.mod_data.author' + field + '\' | translate }}">';
            template = template.replace(replace, render);
        });
        return template;
    };

    /**
     * Return the form data.
     *
     * @param  {Object} form Form (DOM element).
     * @return {Object}      Data retrieved from form.
     */
    function getFormData(form) {
        var formData = {};

        angular.forEach(form.elements, function(element) {
            var name = element.name || '';
            // Ignore submit inputs.
            if (!name || element.type == 'submit' || element.tagName == 'BUTTON') {
                return;
            }

            // Get the value.
            if (element.type == 'checkbox') {
                if (typeof formData[name] == "undefined") {
                    formData[name] = {};
                }
                formData[name][element.value] = !!element.checked;
            } else if (element.type == 'radio') {
                if (element.checked) {
                    formData[name] = element.value;
                }
            } else {
                formData[name] = element.value;
            }
        });

        return formData;
    }

    /**
     * Retrieve the entered data in search in a form.
     * We don't use ng-model because it doesn't detect changes done by JavaScript.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#getSearchDataFromForm
     * @param  {Object} form     Form (DOM element).
     * @param  {Array}  fields   Fields that defines every content in the entry.
     * @return {Object}          Object with the answers.
     */
    self.getSearchDataFromForm = function(form, fields) {
        if (!form || !form.elements) {
            return {};
        }

        var searchedData = getFormData(form);

        // Filter and translate fields to each field plugin.
        var advancedSearch = [];
        angular.forEach(fields, function(field) {
            var fieldData = $mmaModDataFieldsDelegate.getFieldSearchData(field, searchedData);
            if (fieldData) {
                angular.forEach(fieldData, function(data) {
                    data.value = JSON.stringify(data.value);
                    // WS wants values in Json format.
                    advancedSearch.push(data);
                });
            }
        });

        // Not pluginable other search elements.
        angular.forEach(self.searchOther, function(field, name) {
            if (searchedData[name]) {
                // WS wants values in Json format.
                advancedSearch.push({
                    name: name,
                    value: JSON.stringify(searchedData[name])
                });
            }
        });

        return advancedSearch;
    };

    /**
     * Displays Edit Search Fields.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#displayEditFields
     * @param {String} template   Template HMTL.
     * @param {Array}  fields     Fields that defines every content in the entry.
     * @param {Array}  [contents] Contents for the editing entry (if editing).
     * @return {String}         Generated HTML.
     */
    self.displayEditFields = function(template, fields) {
        var replace;

        // Replace the fields found on template.
        angular.forEach(fields, function(field) {
            replace = "[[" + field.name + "]]";
            replace = replace.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            replace = new RegExp(replace);

            // Replace field by a generic directive.
            var render = '<mma-mod-data-field mode="edit" field="fields['+ field.id + ']" value="entryContents['+ field.id + ']" database="data" error="errors['+ field.id + ']"></mma-mod-data-field>';
            template = template.replace(replace, render);

            // Replace the field id tag.
            replace = "[[" + field.name + "#id]]";
            replace = replace.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
            replace = new RegExp(replace);

            template = template.replace(replace, 'field_'+ field.id);
        });

        return template;
    };

    /**
     * Retrieve the entered data in the edit form.
     * We don't use ng-model because it doesn't detect changes done by JavaScript.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#getEditDataFromForm
     * @param  {Object}  form            Form (DOM element).
     * @param  {Array}   fields          Fields that defines every content in the entry.
     * @param  {Number}  [dataId]        Database Id. If set, files will be uploaded and itemId set.
     * @param  {Object}   entryContents  Original entry contents indexed by field id.
     * @return {Promise}                 That contains object with the answers.
     */
    self.getEditDataFromForm = function(form, fields, dataId, entryContents) {
        if (!form || !form.elements) {
            return $q.when({});
        }

        var formData = getFormData(form);

        // Filter and translate fields to each field plugin.
        var edit = [],
            promises = [];
        angular.forEach(fields, function(field) {
            promises.push($q.when($mmaModDataFieldsDelegate.getFieldEditData(field, formData, entryContents[field.id]))
                    .then(function (fieldData) {
                if (fieldData) {
                    var proms = [];

                    angular.forEach(fieldData, function(data) {
                        var dataProm;

                        // Upload Files if asked.
                        if (dataId && data.files) {
                            dataProm = self.uploadOrStoreFiles(dataId, 0, undefined, data.files).then(function(itemId) {
                                delete data.files;
                                data.value = itemId;
                            });
                        } else {
                            dataProm = $q.when();
                        }

                        proms.push(dataProm.then(function() {
                            if (data.value) {
                                data.value = JSON.stringify(data.value);
                            }
                            if (typeof data.subfield == "undefined") {
                                data.subfield = "";
                            }

                            // WS wants values in Json format.
                            edit.push(data);
                        }));
                    });

                    return $q.all(proms);
                }
            }));
        });

        return $q.all(promises).then(function() {
            return edit;
        });
    };

    /**
     * Retrieve the temp files to be updated.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#getEditTmpFiles
     * @param  {Object}  form            Form (DOM element).
     * @param  {Array}   fields          Fields that defines every content in the entry.
     * @param  {Number}  [dataId]        Database Id. If set, fils will be uploaded and itemId set.
     * @param  {Object}   entryContents  Original entry contents indexed by field id.
     * @return {Promise}                 That contains object with the files.
     */
    self.getEditTmpFiles = function(form, fields, dataId, entryContents) {
        if (!form || !form.elements) {
            return $q.when([]);
        }

        var formData = getFormData(form);

        // Filter and translate fields to each field plugin.
        var promises = [];
        angular.forEach(fields, function(field) {
            promises.push(
                $q.when($mmaModDataFieldsDelegate.getFieldEditFiles(field, formData, entryContents[field.id]))
            );
        });

        return $q.all(promises).then(function(fieldsFiles) {
            var files = [];

            angular.forEach(fieldsFiles, function(fieldFiles) {
                files = files.concat(fieldFiles);
            });
            return files;
        });
    };

    /**
     * Check if data has been changed by the user.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#hasEditDataChanged
     * @param  {Object}  form           Form (DOM element).
     * @param  {Array}   fields         Fields that defines every content in the entry.
     * @param  {Number}  [dataId]       Database Id. If set, fils will be uploaded and itemId set.
     * @param  {Object}   entryContents Original entry contents indexed by field id.
     * @return {Promise}                True if changed, false if not.
     */
    self.hasEditDataChanged = function(form, fields, dataId, entryContents) {
        var inputData = getFormData(form),
            promises = [];

        angular.forEach(fields, function(field) {
            promises.push($mmaModDataFieldsDelegate.hasFieldDataChanged(field, inputData, entryContents[field.id]));
        });
        // Will reject on first change detected.
        return $q.all(promises).then(function() {
            // No changes.
            return false;
        }).catch(function() {
            // Has changes.
            return true;
        });
    };

    /**
     * Upload or store some files, depending if the user is offline or not.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#uploadOrStoreFiles
     * @param  {Number}   dataId        Database ID.
     * @param  {Number}   [itemId]      Draft ID to use. Undefined or 0 to create a new draft ID.
     * @param  {Number}   [timecreated] The time the entry was created.
     * @param  {Object[]} files         List of files.
     * @param  {Boolean}  offline       True if files sould be stored for offline, false to upload them.
     * @param  {String}   [siteId]      Site ID. If not defined, current site.
     * @return {Promise}                Promise resolved if success.
     */
    self.uploadOrStoreFiles = function(dataId, itemId, timecreated, files, offline, siteId) {
        if (offline) {
            // @todo in future issues.
            //return self.storeFiles(dataId, timecreated, files, siteId);
        }
        return $mmFileUploader.uploadOrReuploadFiles(files, mmaModDataComponent, itemId, siteId);
    };

    /**
     * Add a prefix to all rules in a CSS string.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#prefixCSS
     * @param {String} css      CSS code to be prefixed.
     * @param {String} prefix   Prefix css selector.
     * @return {String}         Prefixed CSS.
     */
    self.prefixCSS = function(css, prefix) {
        if (!css) {
            return "";
        }
        // Remove comments first.
        var regExp = /\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm;
        css = css.replace(regExp, "");
        // Add prefix.
        regExp = /([^]*?)({[^]*?}|,)/g;
        return css.replace(regExp, prefix + " $1 $2");
    };

    /**
     * Replaces HTML comments by MM native comments.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#replaceComments
     * @param {String} html             HTML to be replaced.
     * @param {Array}  entries          Entries to be placed in the comments.
     * @param {Number} commentsNumber   Number of times we have to add the comments to every entry.
     * @return {String}                 HTML with native comments.
     */
    self.replaceComments = function(html, entries, commentsNumber) {
        html = angular.element(html);

        var links = html.find('a'),
            entryIdx = 0,
            timesAdded = 0;

        // Replace current comment area by the native directive.
        angular.forEach(links, function(link) {
            link = angular.element(link);
            if (link.hasClass('showcommentsnonjs')) {
                var entryId = entries[entryIdx].id;
                link.parent().replaceWith('<mm-comments context-level="module" instance-id="{{data.coursemodule}}" component="mod_data" item-id="' + entryId + '" area="database_entry"></mm-comments>');

                // Only go forward the entries array if we've added the comments this number of times.
                timesAdded++;
                if (timesAdded >= commentsNumber) {
                    entryIdx++;
                    timesAdded = 0;
                }
            }
        });

        var content = "";
        angular.forEach(html, function(entry) {
            content += entry.outerHTML;
        });
        return content;
    };


    /**
     * Get page info related to an entry.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#getPageInfoByEntry
     * @param  {Number}    dataId          Data ID.
     * @param  {Number}    entryId         Entry ID.
     * @param  {Number}    groupId         Group ID.
     * @param  {String}    siteId          Site ID. Current if not defined.
     * @return {Promise}        Containing page number, if has next and have following page.
     */
    self.getPageInfoByEntry = function(dataId, entryId, groupId, siteId) {
        return self.getAllEntriesIds(dataId, groupId, siteId).then(function(entries) {
            for (var index in entries) {
                if (entries[index] == entryId) {
                    index = parseInt(index, 10);
                    return {
                        previousId: entries[index - 1] || false,
                        nextId: entries[index + 1] || false,
                        entryId: entryId,
                        page: index + 1, // Parsed to natural language.
                        numEntries: entries.length
                    };
                }
            }
            return false;
        });
    };

    /**
     * Get page info related to an entry by page number.
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#getPageInfoByPage
     * @param  {Number}    dataId          Data ID.
     * @param  {Number}    page            Page number.
     * @param  {Number}    groupId         Group ID.
     * @param  {String}    siteId          Site ID. Current if not defined.
     * @return {Promise}        Containing page number, if has next and have following page.
     */
    self.getPageInfoByPage = function(dataId, page, groupId, siteId) {
        return self.getAllEntriesIds(dataId, groupId, siteId).then(function(entries) {
            var index = parseInt(page, 10) - 1,
                entryId = entries[index];
            if (entryId) {
                return {
                    previousId: entries[index - 1] || false,
                    nextId: entries[index + 1] || false,
                    entryId: entryId,
                    page: page, // Parsed to natural language.
                    numEntries: entries.length
                };
            }
            return false;
        });
    };

    /**
     * Fetch all entries and return it's Id
     *
     * @module mm.addons.mod_data
     * @ngdoc method
     * @name $mmaModDataHelper#getAllEntriesIds
     * @param  {Number}    dataId          Data ID.
     * @param  {Number}    groupId         Group ID.
     * @param  {String}    siteId          Site ID. Current if not defined.
     * @return {Promise}        Containing and array of EntryId.
     */
    self.getAllEntriesIds = function(dataId, groupId, siteId) {
        return $mmaModData.fetchAllEntries(dataId, groupId, undefined, undefined, undefined, undefined, true, undefined, siteId)
                .then(function(entries) {
            return entries.map(function(entry) {
                return entry.id;
            });
        });
    };


    return self;
});
