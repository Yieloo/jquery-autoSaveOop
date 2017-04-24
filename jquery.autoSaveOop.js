/**
 * NOTES :
 * - Lorsque je fais un serialize(), ne sont pris en compte que les champs non cach�s du formulaire.
 *   Du coup si j'affiche "Joindre un fichier" et que je quitte la page sans rien remplir,
 *   au prochain chargement, il d�tectera une sauvegarde vide.
 */
(function ($) {
    $.fn.autoSaveOop = function (o) {
        var o = $.extend({}, $.fn.autoSaveOop.defaults, o),
            id_utilisateur,
            id_table_ik_parent,
            id_parent,
            id_table_ik,
            id_objet,
            params_requete,
            parametres_origine,
            sauvegarde_supprimee,
            parametres_sauvegardes,
            requete_save,
            self = this,
            sauvegarde_supprimee = false;

        return this.addClass('autosave')
            .on('autoSaveOop.config', function () {
                /**** Fonction appel�e pour initialiser une sauvegarde ****/
                id_utilisateur = $(self).find('#bk_id_utilisateur').val();
                id_table_ik_parent = $(self).find('#bk_id_table_parent').val();
                id_parent = $(self).find('#bk_id_parent').val();
                id_table_ik = $(self).find('#bk_id_table_ik').val();
                id_objet = $(self).find('#bk_id_objet').val();

                //Champs cach�s du fomulaire qui d�finissent la cl� primaire de la sauvegarde
                params_requete = 'id_utilisateur=' + id_utilisateur + '&id_table_parent=' + id_table_ik_parent + '&id_parent=' + id_parent + '&id_table_ik=' + id_table_ik + '&id_objet=' + id_objet;

                //Formulaire s�rializ� au chargement de la page
                parametres_origine = $(self).serialize();

                //Appel de la fonction qui va d�tecter s'il y a une sauvegarde
                $(self).trigger('autoSaveOop.restore');

                //Cas o� on doit d�clencher le save() sur un tinyMCE
                //On doit alors sp�cifier l'id du tinyMCE
                if (o.idTinyMCE != '') {
                    setTimeout(function () {
                        //tinymce.execCommand('mceFocus',false,o.idTinyMCE); //V3
                        tinymce.get(o.idTinyMCE).focus(); //V4

                        if (!$('#' + o.idTinyMCE).hasClass('no_focus')) {
                            setInterval(function () {
                                $(self).trigger('autoSaveOop.save');
                            }, o.interval);
                        }
                        $(self).find('input[type=text],textarea').addClass('no_focus');
                    }, 500);
                }
                else {
                    //Sur le focus, je d�clenche le compteur de sauvegarde
                    $(self).find('input[type=text],textarea').focus(function (event) {
                        if (!$(this).hasClass('no_focus')) {
                            setInterval(function () {
                                $(self).trigger('autoSaveOop.save');
                            }, o.interval);
                        }
                        $(self).find('input[type=text],textarea').addClass('no_focus');
                    });
                }

                $('.bouton_annuler').click(function () {
                    $('form.autosave').trigger('autoSaveOop.delete');
                });

            }).on('autoSaveOop.restore', function () {
                /**** Fonction appel�e pour restaurer une sauvegarde ****/
                $.ajax({
                    async: false,
                    url: o.niveau + '/fonction_ajax.php',
                    dataType: 'text',
                    type: 'post',
                    data: 'fonction=get_sauvegarde_objet_utilisateur&echo=true&' + params_requete,
                    beforeSend: function () {
                    },
                    success: function (parametres) {
                        if (parametres) {
                            tab_parametres = parametres.split("&");
                            for (i in tab_parametres) { //Pour chaque champ r�cup�r�
                                sous_tab = tab_parametres[i].split("=");
                                name = sous_tab[0];
                                value = decodeURIComponent(sous_tab[1]);
                                champ = $(self).find('[name="' + name + '"]');

                                //Si le champs ne fait pas partie des champs exclus de la restauration...
                                if ($.inArray(name, o.champsNePasRestaurer) === -1) {
                                    if (champ.hasClass(o.classTinyMCE)) { //Traitement sp�cial pour TinyMCE
                                        var tinyId = champ.attr('id');
                                        var tinyText = value; // obligatoire sinon, dans 500 ms, on aura une des valeurs suivantes
                                        // on attend 500 ms que TinyMCE soit lanc� et
                                        // trouve l'�diteur avec son id
                                        setTimeout(function () {
                                            var tiny = tinymce.get(tinyId);
                                            tiny.setContent(tinyText);
                                        }, 500);
                                    } else if (champ.attr('type') == 'radio') { //Bouton radio
                                        champ.each(function () {
                                            if ($(this).val() == value) {
                                                $(this).prop('checked', true);
                                            }
                                        });
                                    } else if (champ.attr('type') == 'checkbox') { //Checkbox
                                        if (value == 'on' || value != '') {
                                            champ.prop('checked', true);
                                        }
                                    } else { //text, select, hidden
                                        champ.val(value).trigger('change');
                                    }
                                }
                            }
                            console.log('Form restored');
                            $(self).trigger('autoSaveOop.delete');
                            setTimeout(function () {
                                o.onRestore.call(this);
                            }, 1000);
                        }
                    },
                    complete: function () {
                    }
                });

            }).on('autoSaveOop.save', function () {
                /**** Fonction appel�e pour faire une sauvegarde du formulaire ****/
                tinyMCE.triggerSave(true, true);
                parametres_instant_t = $(self).serialize();

                //S'il n'y a eu aucun changement dans le formulaire depuis son chargement on supprime la sauvegarde �ventuelle
                if (parametres_origine == parametres_instant_t) {
                    if (sauvegarde_supprimee == false) {
                        //log('del');
                        $(self).trigger('autoSaveOop.delete');
                    }//else log('stand del');
                    sauvegarde_supprimee = true;
                } else {
                    sauvegarde_supprimee = false;
                    //On ne r� enregistre pas si les param�tres n'ont pas chang� depuis la derni�re sauvegarde
                    if (parametres_sauvegardes != parametres_instant_t) {
                        //log('bk');
                        requete_save = $.ajax({
                            async: (o.async == undefined) ? true : o.async,
                            url: o.niveau + '/fonction_ajax.php',
                            type: 'post',
                            data: 'fonction=sauvegarder_objet_utilisateur&' + params_requete + '&data=' + escape(parametres_instant_t),
                            success: function (data) {
                                console.log('Form saved');
                            }
                        });
                    }//else log('stand bk');
                    parametres_sauvegardes = parametres_instant_t;
                }

            }).on('autoSaveOop.delete', function () {
                /**** Fonction appel�e pour supprimer une sauvegarde ****/
                $.ajax({
                    async: true,
                    url: o.niveau + '/fonction_ajax.php',
                    type: 'post',
                    data: 'fonction=supprimer_sauvegarde_objet_utilisateur&' + params_requete
                });

            })
            .on('submit', function () {
                $(self).off('autoSaveOop.save');
            })
            .trigger('autoSaveOop.config') /**** Trigger pour initialiser la sauvegarde d'un formulaire ****/;
    };

    $.fn.autoSaveOop.defaults = {
        onRestore: function () {
        },
        declencheur: 'form[name=formulaire]',
        interval: 10000,
        niveau: '../..',
        async: true,
        classTinyMCE: 'txt_tiny',
        idTinyMCE: '', //si pas vide, alors on donne le focus au TinyMCE et on d�clenche le save()
        champsNePasRestaurer: [] //Liste des champs à ne pas restaurer
    };
})(jQuery);