#pragma once

#include <string>
#include <vector>
#include <map>

#include "StringUtils.h"

namespace WebAccounts {
    typedef char byte;

    /*! \brief Represents the Card's data used in the game over the network*/
    struct CardModel {
        std::vector<char> codes; //!< Every code this card can have
        int damage; //!< Base damage
        bool isTFC; //!< is Time Freeze Card?
        std::string element, secondaryElement; //!< Element this card can be
        std::string description, verboseDescription; //!< Description of the card
        std::string imageURL, iconURL; //!< Icons of the card
        std::string id; //!< ID of the card
        std::string name; //!< Name of the card

        byte* imageData, *iconData; //!< Image buffer data to be used by a graphics API
        size_t imageDataLen, iconDataLen; //!< Length of image buffer

        CardModel() = default;
        CardModel(const CardModel& rhs) = default;
    };

    /*! \brief A lightweight card structure used in battle. This will point to a card model that contains all the data*/
    struct Card {
        std::string modelId; //!< ID of the CardModel this structure will reference
        std::string id; //!< unique ID of this card implementation
        char code; //!< The unique code this card represents

        Card() = default;

        Card(const std::string& id) {
            this->modelId = std::string();
            code = '*';
            this->id = id;
        }

        Card(const Card& rhs) = default;
    };

    /*! \brief Folder structure contains cards. This will be fed into the battle engine to read from during battles */
    struct Folder {
        /*! \brief The state of this folder needs to be synced with remote. This flag represents the sync action to use. */
        enum class RemoteActionMode {
            NONE = 0,
            UPDATE,
            CREATE,
            DESTROY
        } mode;

        std::string name; //!< Name of the folder
        std::string id; //!< unique ID of the folder in the database
        std::vector<std::string> cards; //!< List of card IDs

        Folder() = default;
        Folder(const std::string& id) {
            this->mode = RemoteActionMode::NONE;
            this->name = std::string();
            this->cards = std::vector<std::string>();
            this->id = id;
        }

        Folder(const Folder& rhs) = default;
    };

    /*! \brief local account structure is a copy of the remote account and will be synced to the server periodically */
    struct AccountState {
        using CardModelCache = std::map<std::string, std::shared_ptr<CardModel>>;
        CardModelCache cardModels; //!< cache of the downloaded card model data so we don't poll the server each time

        using CardCache = std::map<std::string, std::shared_ptr<Card>>;
        CardCache cards; //!< cache of the downloaded card data

        using FolderCache = std::map<std::string, std::shared_ptr<Folder>>;
        FolderCache folders; //!< cache of the folder data

        AccountState() = default;
        AccountState(const AccountState& rhs) = default;
    };

    /*! \brief simple representation of an HTTP cookie from a server */
    struct Cookie {
        using KeyValuePairs = std::map<std::string, std::string>;
        KeyValuePairs attributes; //!< Hash of attributes which are key-value pairs
        long long expires; //!< If the cookie has an `Expires` key, this will be parsed and stored here
        std::vector<std::string> errors; //!< Any errors parsing the cookie

        Cookie() = default;
        Cookie(const Cookie& rhs) = default;

        /*! \brief given a string from the Set-Cookie header, parses and returns a trivial Cookie object */
        static Cookie ParseHeader(const std::string& header) {
            Cookie cookie;

            auto attributes = split(header, ';');

            for (auto&& attr : attributes) {
                auto keyvalue = split(attr, '=');

                size_t size = keyvalue.size();

                switch (size) {
                case 1:
                    cookie.attributes.insert(std::make_pair(keyvalue[0], ""));
                    break;
                case 2:
                    cookie.attributes.insert(std::make_pair(keyvalue[0], keyvalue[1]));
                    break;
                default:
                    cookie.errors.push_back("Could not parse the following cookie attribute: '" + attr + "'");
                }
            }

            return cookie;
        }
    };
}
